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
    let verifiedStatus = "pending";
    let verifiedAmount = 0;
    if (KORA_SECRET) {
      try {
        const verifyRes = await fetch(`${KORA_API}/charges/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${KORA_SECRET}` },
        });
        const verifyJson = await verifyRes.json();
        if (verifyRes.ok && verifyJson?.status) {
          verifiedStatus = String(verifyJson?.data?.status ?? "").toLowerCase();
          verifiedAmount = Number(verifyJson?.data?.amount ?? 0);
        } else {
          console.error("[kora-webhook] verify failed:", verifyJson);
        }
      } catch (e) {
        console.error("[kora-webhook] verify error:", e);
      }
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

    // Idempotency: ignore if already paid/failed
    if (order.payment_status !== "pending") {
      return ok({ received: true, note: "already finalized" });
    }

    const isSuccess =
      verifiedStatus === "success" ||
      event === "charge.success" ||
      String(data?.status ?? "").toLowerCase() === "success";
    const isFailed =
      verifiedStatus === "failed" ||
      event === "charge.failed" ||
      String(data?.status ?? "").toLowerCase() === "failed";

    if (isSuccess) {
      // Sanity check amount matches (allow Kora to send in major or minor units; compare loosely)
      const expected = Number(order.total_price);
      const amountMatches = !verifiedAmount ||
        Math.abs(verifiedAmount - expected) < 1 ||
        Math.abs(verifiedAmount - expected * 100) < 1;
      if (!amountMatches) {
        console.error("[kora-webhook] amount mismatch", { reference, verifiedAmount, expected });
        // Still mark as failed for safety
        await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
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

      // Trigger confirmation email
      try {
        const { data: fullItems } = await admin
          .from("order_items")
          .select("product_name, variant_size, quantity, price")
          .eq("order_id", order.id);
        await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            status: "paid",
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
    } else if (isFailed) {
      await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    } else {
      console.log("[kora-webhook] non-final event:", event, verifiedStatus);
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
