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
    result: typeof search.result === "string" ? search.result : "",
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
  payment_status: "pending" | "paid" | "failed" | "cancelled";
  delivery_status: string;
  fulfillment: "delivery" | "pickup";
  state: string | null;
  created_at: string;
  order_items: { product_name: string; variant_size: string; quantity: number; price: number }[];
};

function SuccessPage() {
  const { ref, result } = Route.useSearch();
  const { clear } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function reconcile(): Promise<void> {
      // Ask the server to verify the Kora charge and finalize the order. This is
      // the authoritative reconciliation: it marks the order paid/cancelled even
      // when Kora's webhook was missed (e.g. the customer closed checkout).
      const { data } = await supabase.functions.invoke("verify-order", {
        body: { order_code: ref },
      });
      if (cancelled) return;

      const status = (data as any)?.payment_status as Order["payment_status"] | undefined;
      if (status) {
        // Refetch full order details for display.
        const { data: full } = await supabase
          .from("orders")
          .select(
            "id, order_code, customer_name, email, address, subtotal, shipping_fee, total_price, payment_status, delivery_status, fulfillment, state, created_at, order_items(product_name, variant_size, quantity, price)",
          )
          .eq("order_code", ref)
          .maybeSingle();
        if (!cancelled && full) setOrder(full as unknown as Order);
      }
      setLoading(false);

      // Keep polling while still pending (e.g. bank transfer still settling), but
      // cap it so a genuinely cancelled payment doesn't poll forever.
      if (status === "pending" && attempts < 10) {
        attempts += 1;
        timer = setTimeout(reconcile, 3000);
      }
    }
    if (ref) reconcile();
    else setLoading(false);

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [ref]);

  // Clear the cart only once payment is actually confirmed. For pending or
  // failed (e.g. cancelled) payments we keep the cart so the customer can retry.
  useEffect(() => {
    if (order?.payment_status === "paid") clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.payment_status]);

  const status = order?.payment_status;

  // How to present the result. A customer who returns from Kora without a
  // confirmed payment (cancel/close/abandon) must NEVER see "Order received".
  const view: "paid" | "cancelled" | "pending-cancelled" | "pending" = !status
    ? "pending"
    : status === "paid"
      ? "paid"
      : status === "cancelled" || status === "failed" || result === "cancelled"
        ? "cancelled"
        : result === "pending"
          ? "pending-cancelled"
          : "pending";
  const isPaid = view === "paid";
  const isCancelledState = view === "cancelled";
  const isPendingCancelled = view === "pending-cancelled";
  const needsPayment = isCancelledState || isPendingCancelled;

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-5 py-20 text-center md:px-8 md:py-28">
        {isPaid ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
            <CheckCircle2 className="h-8 w-8 text-accent" />
          </div>
        ) : needsPayment ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <CheckCircle2 className="h-8 w-8 text-destructive" />
          </div>
        ) : (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <p className="mt-6 text-xs uppercase tracking-luxe text-accent">
          {isPaid ? "Thank you" : isCancelledState ? "Order cancelled" : isPendingCancelled ? "Payment not completed" : "One moment"}
        </p>
        <h1 className="mt-4 font-display text-5xl">
          {isPaid
            ? "Payment successful"
            : isCancelledState
              ? "Order cancelled"
              : isPendingCancelled
                ? "Payment not completed"
                : "Order received"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {isPaid
            ? "Your fragrance is being prepared. A confirmation email is on its way."
            : isCancelledState
              ? "Your payment was cancelled, so we can't process or ship this order until payment is made. No charge has been taken — please complete your payment to place the order."
              : isPendingCancelled
                ? "We couldn't confirm your payment, so your order hasn't been placed. No charge has been taken — please complete your payment to place the order."
                : "We're confirming your payment. This usually takes a few seconds."}
        </p>

        {needsPayment && (
          <Link
            to="/cart"
            className="mt-8 inline-block bg-primary px-8 py-4 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90"
          >
            Back to cart to pay
          </Link>
        )}

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
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Fulfillment</span>
              <span className="uppercase tracking-luxe">
                {order.fulfillment === "pickup" ? "Pickup" : order.state ? `Delivery — ${order.state}` : "Delivery"}
              </span>
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
                  <span>{isPaid ? "Total paid" : needsPayment ? "Total due" : "Total"}</span>
                  <span>{formatNGN(Number(order.total_price))}</span>
                </div>
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                {isPaid
                  ? <>A confirmation has been sent to <span className="text-foreground">{order.email}</span>. Please save this Order ID for reference.</>
                  : <>No charge has been taken and we can't process this order until payment is made. An email was sent to <span className="text-foreground">{order.email}</span> — please complete your payment to confirm the order.</>}
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
