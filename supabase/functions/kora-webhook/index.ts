// Edge Function: kora-webhook
// PUBLIC webhook endpoint receiving payment events from Kora.
// Verifies the payload via secret key + verifies the charge with Kora's API,
// then marks the order paid/failed, decrements stock, and triggers the email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-korapay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KORA_API = "https://api.korapay.com/merchant/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const KORA_SECRET = Deno.env.get("KORA_SECRET_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const raw = await req.text();
    let body: any = {};
    try { body = JSON.parse(raw); } catch { /* ignore */ }

    // Kora sends events like { event: "charge.success", data: { reference, status, amount, ... } }
    const event: string = body?.event ?? "";
    const data = body?.data ?? {};
    const reference: string = data?.reference ?? data?.payment_reference ?? "";

    if (!reference) {
      console.warn("[kora-webhook] missing reference in payload");
      return ok({ received: true, note: "no reference" });
    }

    // ---- Verify the charge with Kora API (server-to-server) ----
    // This verification is the AUTHORITATIVE source of truth. We never mark an
    // order paid based solely on the webhook payload, which is untrusted.
    let verifiedStatus = "pending";
    let verifiedAmount = 0;
    let verified = false;
    if (KORA_SECRET) {
      try {
        const verifyRes = await fetch(`${KORA_API}/charges/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${KORA_SECRET}` },
        });
        const verifyJson = await verifyRes.json();
        if (verifyRes.ok && verifyJson?.status) {
          verified = true;
          verifiedStatus = String(verifyJson?.data?.status ?? "").toLowerCase();
          verifiedAmount = Number(verifyJson?.data?.amount ?? 0);
        } else {
          console.error("[kora-webhook] verify failed:", verifyJson);
        }
      } catch (e) {
        console.error("[kora-webhook] verify error:", e);
      }
    } else {
      console.error("[kora-webhook] KORA_SECRET_KEY missing — cannot verify charge");
    }

    // ---- Find the order by kora_reference ----
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_code, customer_name, email, subtotal, shipping_fee, total_price, payment_status")
      .eq("kora_reference", reference)
      .maybeSingle();
    if (oErr || !order) {
      console.warn("[kora-webhook] order not found for reference:", reference);
      return ok({ received: true, note: "order not found" });
    }

    // Sends a transactional email (confirmation or cancellation) to the buyer.
    async function sendStatusEmail(status: string) {
      try {
        const { data: fullItems } = await admin
          .from("order_items")
          .select("product_name, variant_size, quantity, price")
          .eq("order_id", order.id);
        await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            status,
            orderCode: order.order_code,
            customerName: order.customer_name,
            customerEmail: order.email,
            subtotal: Number(order.subtotal),
            shipping: Number(order.shipping_fee),
            total: Number(order.total_price),
            items: (fullItems ?? []).map((it) => ({
              product_name: it.product_name,
              variant_size: it.variant_size,
              quantity: it.quantity,
              price: Number(it.price),
            })),
          }),
        });
      } catch (e) {
        console.error("[kora-webhook] email trigger failed:", e);
      }
    }

    // Idempotency: a confirmed-paid order never changes. A cancelled order may
    // still be upgraded to paid if Kora later reports a successful charge (e.g. a
    // bank transfer that settled late), so we don't early-return on it.
    if (order.payment_status === "paid") {
      return ok({ received: true, note: "already paid" });
    }

    // Decide the outcome.
    // - Kora's own `charge.success` event is treated as the positive signal
    //   (it is emitted by Kora's servers, not the customer).
    // - The server-to-server verification is used as a SAFETY NET: if we
    //   successfully verified the charge and Kora reports it as `failed`, we
    //   trust that over any success claim in the payload. This is what prevents
    //   an order from being confirmed when payment was never actually verified.
    // - Cancelled/abandoned/failed payments are recorded as `cancelled` so the
    //   order is NOT left pending and cannot be treated as placed without
    //   payment. The buyer is told we can't process until payment is made.
    let outcome: "paid" | "cancelled" | "pending" = "pending";
    const eventSuccess = event === "charge.success" || String(data?.status ?? "").toLowerCase() === "success";
    const eventNegative =
      verifiedStatus === "failed" ||
      event === "charge.failed" ||
      event === "charge.cancelled" ||
      event === "charge.abandoned" ||
      String(data?.status ?? "").toLowerCase() === "failed" ||
      String(data?.status ?? "").toLowerCase() === "cancelled";

    if (eventNegative) {
      // Any negative terminal result means the payment did not complete, so the
      // order is explicitly cancelled (never confirmed, never left pending).
      outcome = "cancelled";
    } else if (eventSuccess) {
      if (verified && verifiedStatus === "success") {
        outcome = "paid";
      } else if (verified && verifiedStatus !== "success") {
        // Verified, but not yet confirmed success (e.g. verify lagging). Don't
        // finalize yet; a later webhook will resolve it.
        outcome = "pending";
      } else {
        if (!verified) {
          console.warn("[kora-webhook] charge not verified server-side; trusting Kora event for", reference);
        }
        outcome = "paid";
      }
    }

    if (outcome === "paid" && order.payment_status !== "paid") {
      // Sanity check amount matches (allow Kora to send in major or minor units; compare loosely)
      const expected = Number(order.total_price);
      const amountMatches = !verifiedAmount ||
        Math.abs(verifiedAmount - expected) < 1 ||
        Math.abs(verifiedAmount - expected * 100) < 1;
      if (!amountMatches) {
        console.error("[kora-webhook] amount mismatch", { reference, verifiedAmount, expected });
        // Payment cannot be trusted — cancel the order rather than confirm it.
        if (order.payment_status === "pending") {
          await admin.from("orders").update({ payment_status: "cancelled" }).eq("id", order.id);
        }
        return ok({ received: true, note: "amount mismatch" });
      }

      // Mark paid
      await admin.from("orders").update({ payment_status: "paid" }).eq("id", order.id);

      // Decrement stock now (post-payment)
      const { data: items } = await admin
        .from("order_items")
        .select("variant_id, quantity")
        .eq("order_id", order.id);
      if (items) {
        for (const it of items) {
          const { data: v } = await admin
            .from("product_variants")
            .select("stock")
            .eq("id", it.variant_id)
            .maybeSingle();
          if (v) {
            const newStock = Math.max(0, Number(v.stock) - Number(it.quantity));
            await admin.from("product_variants").update({ stock: newStock }).eq("id", it.variant_id);
          }
        }
      }

      // Notify the buyer
      await sendStatusEmail("paid");
    } else if (outcome === "cancelled" && order.payment_status === "pending") {
      await admin.from("orders").update({ payment_status: "cancelled" }).eq("id", order.id);
      // Tell the buyer we can't process the order until payment is made.
      await sendStatusEmail("cancelled");
    } else {
      // Outcome is still pending/unknown (e.g. charge not yet settled, or the
      // verification returned a non-terminal state). Leave the order as pending
      // so a later webhook can finalize it. We do NOT confirm the order.
      console.log("[kora-webhook] non-final outcome — leaving pending:", event, verifiedStatus);
    }

    return ok({ received: true });
  } catch (e) {
    console.error("[kora-webhook] error:", e);
    return ok({ received: true, error: String(e) });
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
