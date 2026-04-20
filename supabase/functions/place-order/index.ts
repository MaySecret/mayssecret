// Edge Function: place-order
// Auth required. Validates stock, recomputes totals server-side,
// creates order + items, decrements stock, clears the user's cart.
// Then triggers the customer/admin confirmation email.

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
  items: { variant_id: string; quantity: number }[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller (must be authenticated)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const payload = (await req.json()) as Payload;
    if (
      !payload?.customer_name?.trim() ||
      !payload?.phone?.trim() ||
      !payload?.email?.trim() ||
      !payload?.address?.trim() ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return json({ error: "Invalid payload" }, 400);
    }
    for (const it of payload.items) {
      if (!it.variant_id || typeof it.quantity !== "number" || it.quantity <= 0 || it.quantity > 100) {
        return json({ error: "Invalid item" }, 400);
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch authoritative variant data
    const variantIds = payload.items.map((i) => i.variant_id);
    const { data: variants, error: vErr } = await admin
      .from("product_variants")
      .select("id, size, price, stock, product_id, products(name, images)")
      .in("id", variantIds);
    if (vErr || !variants || variants.length !== variantIds.length) {
      return json({ error: "One or more items are no longer available" }, 400);
    }

    // Validate stock and compute total
    const orderItems: any[] = [];
    let total = 0;
    for (const it of payload.items) {
      const v = variants.find((x: any) => x.id === it.variant_id);
      if (!v) return json({ error: "Item not found" }, 400);
      if (v.stock < it.quantity) {
        const prodName = (v.products as any)?.name ?? "Item";
        return json({ error: `${prodName} (${v.size}) — only ${v.stock} in stock` }, 409);
      }
      const price = Number(v.price);
      total += price * it.quantity;
      orderItems.push({
        variant_id: v.id,
        product_id: v.product_id,
        product_name: (v.products as any)?.name ?? "",
        variant_size: v.size,
        quantity: it.quantity,
        price,
      });
    }

    // Create order
    const { data: order, error: oErr } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        customer_name: payload.customer_name.trim(),
        phone: payload.phone.trim(),
        email: payload.email.trim(),
        address: payload.address.trim(),
        total_price: total,
      })
      .select("id, order_code")
      .single();
    if (oErr || !order) {
      console.error("[place-order] order insert failed:", oErr);
      return json({ error: "Could not create order" }, 500);
    }

    // Insert items
    const { error: iErr } = await admin
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));
    if (iErr) {
      console.error("[place-order] items insert failed:", iErr);
      await admin.from("orders").delete().eq("id", order.id);
      return json({ error: "Could not save items" }, 500);
    }

    // Decrement stock (best-effort, in serial)
    for (const it of payload.items) {
      const v = variants.find((x: any) => x.id === it.variant_id)!;
      await admin.from("product_variants").update({ stock: v.stock - it.quantity }).eq("id", v.id);
    }

    // Initial status history
    await admin.from("order_status_history").insert({
      order_id: order.id,
      status: "processing",
      note: "Order placed",
      changed_by: user.id,
    });

    // Clear user's cart
    const { data: cart } = await admin.from("carts").select("id").eq("user_id", user.id).maybeSingle();
    if (cart) await admin.from("cart_items").delete().eq("cart_id", cart.id);

    // Fire confirmation email (non-blocking)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          status: "placed",
          orderCode: order.order_code,
          customerName: payload.customer_name,
          customerEmail: payload.email,
          total,
          items: orderItems.map((oi) => ({
            product_name: oi.product_name,
            variant_size: oi.variant_size,
            quantity: oi.quantity,
            price: oi.price,
          })),
        }),
      });
    } catch (e) {
      console.error("[place-order] email trigger failed:", e);
    }

    return json({ id: order.id, order_code: order.order_code }, 200);
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
