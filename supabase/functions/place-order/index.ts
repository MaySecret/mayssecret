// Edge Function: place-order
// PUBLIC — no auth required (guest checkout).
// Validates payload + stock + prices server-side, creates a PENDING order,
// initializes Kora payment, and returns the checkout URL.
// Stock is decremented only after Kora webhook confirms payment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  guest_id?: string;
  items: { variant_id: string; quantity: number }[];
};

const KORA_API = "https://api.korapay.com/merchant/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KORA_SECRET = Deno.env.get("KORA_SECRET_KEY") ?? "";

    const payload = (await req.json()) as Payload;

    // ---- Validate payload ----
    if (
      !payload?.customer_name?.trim() ||
      !payload?.phone?.trim() ||
      !payload?.email?.trim() ||
      !payload?.address?.trim() ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return json({ error: "Missing or invalid checkout details." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
      return json({ error: "Invalid email address." }, 400);
    }
    for (const it of payload.items) {
      if (!it.variant_id || typeof it.quantity !== "number" || it.quantity <= 0 || it.quantity > 100) {
        return json({ error: "Invalid item in cart." }, 400);
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- Fetch authoritative variant data ----
    const variantIds = [...new Set(payload.items.map((i) => i.variant_id))];
    const { data: variants, error: vErr } = await admin
      .from("product_variants")
      .select("id, size, price, stock, product_id, products(name, images)")
      .in("id", variantIds);
    if (vErr || !variants || variants.length !== variantIds.length) {
      return json({ error: "One or more items are no longer available." }, 400);
    }

    // ---- Validate stock + compute subtotal server-side ----
    const orderItems: any[] = [];
    let subtotal = 0;
    for (const it of payload.items) {
      const v = variants.find((x: any) => x.id === it.variant_id);
      if (!v) return json({ error: "Item not found." }, 400);
      if (v.stock < it.quantity) {
        const prodName = (v.products as any)?.name ?? "Item";
        return json({ error: `${prodName} (${v.size}) — only ${v.stock} in stock.` }, 409);
      }
      const price = Number(v.price);
      subtotal += price * it.quantity;
      orderItems.push({
        variant_id: v.id,
        product_id: v.product_id,
        product_name: (v.products as any)?.name ?? "",
        variant_size: v.size,
        quantity: it.quantity,
        price,
      });
    }

    // ---- Shipping fee from settings ----
    const { data: settings } = await admin
      .from("site_settings")
      .select("shipping_fee")
      .limit(1)
      .maybeSingle();
    const shipping_fee = settings ? Number(settings.shipping_fee) : 0;
    const total = subtotal + shipping_fee;

    // ---- Create PENDING order ----
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        customer_name: payload.customer_name.trim(),
        phone: payload.phone.trim(),
        email: payload.email.trim(),
        address: payload.address.trim(),
        guest_id: payload.guest_id ?? null,
        site_origin: origin,
        subtotal,
        shipping_fee,
        total_price: total,
        payment_status: "pending",
        delivery_status: "processing",
      })
      .select("id, order_code")
      .single();
    if (oErr || !order) {
      console.error("[place-order] order insert failed:", oErr);
      return json({ error: "Could not create order." }, 500);
    }

    // ---- Insert items ----
    const { error: iErr } = await admin
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));
    if (iErr) {
      console.error("[place-order] items insert failed:", iErr);
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: "Could not save items." }, 500);
    }

    // ---- Initialize Kora payment ----
    let checkout_url: string | null = null;
    let kora_reference: string | null = null;

    if (!KORA_SECRET) {
      console.error("[place-order] KORA_SECRET_KEY missing — cannot initialize payment.");
      return json({
        order_id: order.id,
        order_code: order.order_code,
        payment_status: "pending",
        error: "Payment is not configured. Please contact the store.",
      }, 200);
    }

    try {
      const reference = `MS-${order.order_code}-${Date.now()}`;
      // Route the customer through order-redirect (a Supabase function) so we
      // verify the charge server-side and only land them on /order/success when
      // actually paid. Cancelled/failed payments are sent to /cart instead.
      const redirect_url = `${SUPABASE_URL}/functions/v1/order-redirect/${encodeURIComponent(order.order_code)}`;

      const koraRes = await fetch(`${KORA_API}/charges/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KORA_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          currency: "NGN",
          reference,
          redirect_url,
          notification_url: `${SUPABASE_URL}/functions/v1/kora-webhook`,
          narration: `May's Secret order ${order.order_code}`,
          customer: {
            name: payload.customer_name.trim(),
            email: payload.email.trim(),
          },
          metadata: {
            order_id: order.id,
            order_code: order.order_code,
          },
        }),
      });
      const koraJson = await koraRes.json();
      if (!koraRes.ok || !koraJson?.status) {
        console.error("[place-order] Kora init failed:", koraJson);
        return json({ error: koraJson?.message || "Could not initialize payment." }, 502);
      }
      checkout_url = koraJson?.data?.checkout_url ?? null;
      kora_reference = reference;
      await admin.from("orders").update({ kora_reference: reference }).eq("id", order.id);
    } catch (e) {
      console.error("[place-order] Kora init error:", e);
      return json({ error: "Payment service unavailable. Please try again." }, 502);
    }

    return json({
      order_id: order.id,
      order_code: order.order_code,
      payment_status: "pending",
      checkout_url,
      kora_reference,
    }, 200);
  } catch (e) {
    console.error("[place-order] error:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
