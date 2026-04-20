import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/order/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
  }),
  component: SuccessPage,
});

type Order = {
  id: string;
  order_code: string;
  customer_name: string;
  email: string;
  address: string;
  subtotal: number;
  shipping_fee: number;
  total_price: number;
  payment_status: "pending" | "paid" | "failed";
  delivery_status: string;
  created_at: string;
  order_items: { product_name: string; variant_size: string; quantity: number; price: number }[];
};

function SuccessPage() {
  const { ref } = Route.useSearch();
  const { clear } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load(): Promise<void> {
      const { data } = await supabase
        .from("orders")
        .select("id, order_code, customer_name, email, address, subtotal, shipping_fee, total_price, payment_status, delivery_status, created_at, order_items(product_name, variant_size, quantity, price)")
        .eq("order_code", ref)
        .maybeSingle();
      if (cancelled) return;
      if (data) setOrder(data as unknown as Order);
      setLoading(false);
      // Poll while pending — webhook may still be processing
      if (data && (data as any).payment_status === "pending") {
        timer = setTimeout(load, 3000);
      }
    }
    if (ref) load();
    else setLoading(false);

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [ref]);

  // Clear cart once we see the order paid (or even pending — order is committed)
  useEffect(() => {
    if (order) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-20 text-center md:px-8 md:py-28">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
          <CheckCircle2 className="h-8 w-8 text-accent" />
        </div>
        <p className="mt-6 text-xs uppercase tracking-luxe text-accent">Thank you</p>
        <h1 className="mt-4 font-display text-5xl">
          {order?.payment_status === "paid" ? "Payment successful" : "Order received"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {order?.payment_status === "paid"
            ? "Your fragrance is being prepared. A confirmation email is on its way."
            : order?.payment_status === "failed"
              ? "Your payment did not go through. Please try again from your cart."
              : "We're confirming your payment. This usually takes a few seconds."}
        </p>

        {loading && <p className="mt-12 text-sm text-muted-foreground">Loading order…</p>}

        {!loading && !order && (
          <p className="mt-12 text-sm text-muted-foreground">
            Order not found. Check your email for the confirmation, or contact us.
          </p>
        )}

        {order && (
          <div className="mt-12 border border-border bg-cream/40 p-8 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono">{order.order_code}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Payment</span>
              <span className="uppercase tracking-luxe">{order.payment_status}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="uppercase tracking-luxe">{order.delivery_status}</span>
            </div>

            <div className="mt-6 space-y-3 border-t border-border pt-4">
              {order.order_items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{it.product_name} — {it.variant_size} × {it.quantity}</span>
                  <span>{formatNGN(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNGN(Number(order.subtotal))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{formatNGN(Number(order.shipping_fee))}</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-xl">
                <span>Total paid</span>
                <span>{formatNGN(Number(order.total_price))}</span>
              </div>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              A confirmation has been sent to <span className="text-foreground">{order.email}</span>. Please save this Order ID for reference.
            </p>
          </div>
        )}

        <Link to="/shop" className="mt-12 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-luxe">
          Continue shopping
        </Link>
      </div>
    </SiteShell>
  );
}
