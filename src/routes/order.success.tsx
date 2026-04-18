import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";

export const Route = createFileRoute("/order/success")({
  validateSearch: (search: Record<string, unknown>) => ({ id: String(search.id ?? "") }),
  component: SuccessPage,
});

type Order = {
  id: string;
  order_code: string;
  customer_name: string;
  total_price: number;
  payment_status: string;
  order_items: { product_name: string; variant_size: string; quantity: number; price: number }[];
};

function SuccessPage() {
  const { id } = Route.useSearch();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_code, customer_name, total_price, payment_status, order_items(product_name, variant_size, quantity, price)")
        .eq("id", id)
        .single();
      if (data) setOrder(data as unknown as Order);
    })();
  }, [id]);

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-20 text-center md:px-8 md:py-28">
        <p className="text-xs uppercase tracking-luxe text-gold">Thank you</p>
        <h1 className="mt-4 font-display text-5xl">Your order is placed</h1>
        <p className="mt-4 text-muted-foreground">
          We have received your order. Payment confirmation will follow shortly.
        </p>

        {order && (
          <div className="mt-12 border border-border bg-cream/40 p-8 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order</span>
              <span className="font-mono">{order.order_code}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="uppercase tracking-luxe">{order.payment_status}</span>
            </div>
            <div className="mt-6 space-y-3 border-t border-border pt-4">
              {order.order_items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{it.product_name} — {it.variant_size} × {it.quantity}</span>
                  <span>{formatNGN(it.price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-border pt-4 font-display text-xl">
              <span>Total</span>
              <span>{formatNGN(Number(order.total_price))}</span>
            </div>
          </div>
        )}

        <Link to="/shop" className="mt-12 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-luxe">
          Continue shopping
        </Link>
      </div>
    </SiteShell>
  );
}
