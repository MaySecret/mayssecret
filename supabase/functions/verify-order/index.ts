// Edge Function: verify-order
// PUBLIC — called by the success page after Kora redirects the customer back.
// Kora's redirect URL carries no payment status, and a "close/cancel" does not
// always produce a webhook. So we verify the charge with Kora's API here
// (server-to-server, using the secret key) and finalize the order: paid,
// cancelled, or still pending. This is the authoritative reconciliation point
// and prevents orders from being left pending (or wrongly confirmed) when the
// webhook is missed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KORA_API = "https://api.korapay.com/merchant/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KORA_SECRET = Deno.env.get("KORA_SECRET_KEY") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { order_code } = (await req.json()) as { order_code?: string };
    if (!order_code) return json({ error: "Missing order_code." }, 400);

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_code, customer_name, email, subtotal, shipping_fee, total_price, payment_status, kora_reference")
      .eq("order_code", order_code)
      .maybeSingle();
    if (oErr || !order) return json({ error: "Order not found." }, 404);

    // Already finalized — nothing to do.
    if (order.payment_status !== "pending") {
      return json({ payment_status: order.payment_status });
    }

    // Can't verify without a reference or secret — leave pending for the webhook.
    if (!order.kora_reference || !KORA_SECRET) {
      return json({ payment_status: "pending" });
    }

    // Verify the charge with Kora (server-to-server, authoritative).
    let verifiedStatus = "pending";
    try {
      const verifyRes = await fetch(`${KORA_API}/charges/${encodeURIComponent(order.kora_reference)}`, {
        headers: { Authorization: `Bearer ${KORA_SECRET}` },
      });
      const verifyJson = await verifyRes.json();
      if (verifyRes.ok && verifyJson?.status) {
        verifiedStatus = String(verifyJson?.data?.status ?? "").toLowerCase();
      } else {
        console.error("[verify-order] verify failed:", verifyJson);
      }
    } catch (e) {
      console.error("[verify-order] verify error:", e);
    }

    let outcome: "paid" | "cancelled" | "pending" = "pending";
    if (verifiedStatus === "success") outcome = "paid";
    else if (verifiedStatus === "failed" || verifiedStatus === "abandoned" || verifiedStatus === "cancelled") {
      outcome = "cancelled";
    }

    if (outcome === "paid") {
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
      await admin.from("orders").update({ payment_status: "paid" }).eq("id", order.id);
      await sendStatusEmail(admin, SUPABASE_URL, SERVICE_KEY, order, "paid");
    } else if (outcome === "cancelled") {
      await admin.from("orders").update({ payment_status: "cancelled" }).eq("id", order.id);
      await sendStatusEmail(admin, SUPABASE_URL, SERVICE_KEY, order, "cancelled");
    }

    return json({ payment_status: outcome });
  } catch (e) {
    console.error("[verify-order] error:", e);
    return json({ error: String(e) }, 500);
  }
});

async function sendStatusEmail(
  admin: any,
  SUPABASE_URL: string,
  SERVICE_KEY: string,
  order: any,
  status: string,
) {
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
        items: (fullItems ?? []).map((it: any) => ({
          product_name: it.product_name,
          variant_size: it.variant_size,
          quantity: it.quantity,
          price: Number(it.price),
        })),
      }),
    });
  } catch (e) {
    console.error("[verify-order] email trigger failed:", e);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
