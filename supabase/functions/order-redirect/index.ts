// Edge Function: order-redirect
// Kora always redirects the customer back to the redirect_url after payment —
// whether it succeeded, failed, OR the customer cancelled/closed checkout. That
// redirect carries no payment status. This function verifies the charge with
// Kora server-side and then sends the browser to the correct frontend route:
//   - paid (or still pending, e.g. bank transfer): /order/success
//   - failed / cancelled / abandoned:            /cart
// So a cancelled payment NEVER lands on the order success page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KORA_API = "https://api.korapay.com/merchant/api/v1";

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KORA_SECRET = Deno.env.get("KORA_SECRET_KEY") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const orderCode = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
    if (!orderCode) return redirect("/");

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_code, customer_name, email, subtotal, shipping_fee, total_price, payment_status, kora_reference, site_origin")
      .eq("order_code", orderCode)
      .maybeSingle();
    if (oErr || !order) return redirect("/");

    const site = String(order.site_origin || "").replace(/\/$/, "");
    const toSuccess = () => redirect(`${site}/order/success?ref=${encodeURIComponent(order.order_code)}`);
    const toCart = () => redirect(`${site}/cart`);

    // Already finalized.
    if (order.payment_status === "paid") return toSuccess();
    if (order.payment_status === "cancelled" || order.payment_status === "failed") return toCart();

    // Verify the charge with Kora (authoritative).
    let verifiedStatus = "pending";
    if (order.kora_reference && KORA_SECRET) {
      try {
        const verifyRes = await fetch(`${KORA_API}/charges/${encodeURIComponent(order.kora_reference)}`, {
          headers: { Authorization: `Bearer ${KORA_SECRET}` },
        });
        const verifyJson = await verifyRes.json();
        if (verifyRes.ok && verifyJson?.status) {
          verifiedStatus = String(verifyJson?.data?.status ?? "").toLowerCase();
        } else {
          console.error("[order-redirect] verify failed:", verifyJson);
        }
      } catch (e) {
        console.error("[order-redirect] verify error:", e);
      }
    }

    if (verifiedStatus === "success") {
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
      return toSuccess();
    }

    if (verifiedStatus === "failed" || verifiedStatus === "abandoned" || verifiedStatus === "cancelled") {
      await admin.from("orders").update({ payment_status: "cancelled" }).eq("id", order.id);
      await sendStatusEmail(admin, SUPABASE_URL, SERVICE_KEY, order, "cancelled");
      return toCart();
    }

    // Still pending (e.g. bank transfer settling) — let the success page poll.
    return toSuccess();
  } catch (e) {
    console.error("[order-redirect] error:", e);
    return redirect("/");
  }
});

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

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
    console.error("[order-redirect] email trigger failed:", e);
  }
}
