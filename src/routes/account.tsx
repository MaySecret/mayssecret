import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useAuth } from "@/lib/auth";
import { formatNGN } from "@/lib/format";

type Order = {
  id: string;
  order_code: string;
  total_price: number;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  order_items: { product_name: string; variant_size: string; quantity: number; price: number }[];
};

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "My account — Mays Secret" }] }),
});

function AccountPage() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  async function loadOrders() {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_code, total_price, payment_status, delivery_status, created_at, order_items(product_name, variant_size, quantity, price)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) ?? []);
    setOrdersLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    loadOrders();
    const ch = supabase
      .channel(`orders:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        () => loadOrders(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading || !user) {
    return <SiteShell><div className="mx-auto max-w-3xl px-5 py-24 text-sm text-muted-foreground">Loading…</div></SiteShell>;
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-20">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">My account</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl">{profile?.display_name || "Welcome"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={signOut} className="border border-border px-4 py-2 text-xs uppercase tracking-luxe hover:bg-cream">
            Sign out
          </button>
        </div>

        <div className="mt-12">
          <h2 className="font-display text-2xl">Your orders</h2>
          {ordersLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : orders.length === 0 ? (
            <div className="mt-6 border border-border bg-cream/30 p-10 text-center">
              <p className="text-muted-foreground">No orders yet.</p>
              <Link to="/shop" className="mt-4 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-luxe">
                Start shopping
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{o.order_code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.payment_status} kind="payment" />
                      <StatusBadge status={o.delivery_status} kind="delivery" />
                    </div>
                    <p className="font-display text-lg">{formatNGN(Number(o.total_price))}</p>
                  </div>
                  <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                    {o.order_items.map((it, i) => (
                      <li key={i} className="flex justify-between text-muted-foreground">
                        <span>{it.product_name} — {it.variant_size} × {it.quantity}</span>
                        <span>{formatNGN(it.price * it.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

function StatusBadge({ status, kind }: { status: string; kind: "payment" | "delivery" }) {
  const tones: Record<string, string> = {
    pending: "border-border text-muted-foreground",
    paid: "border-green-600 text-green-700",
    failed: "border-destructive text-destructive",
    processing: "border-border text-muted-foreground",
    shipped: "border-accent text-accent",
    delivered: "border-green-600 text-green-700",
    cancelled: "border-destructive text-destructive",
  };
  return (
    <span className={`border px-2 py-1 text-[10px] uppercase tracking-luxe ${tones[status] ?? "border-border"}`}>
      {kind === "payment" ? `Pay: ${status}` : status}
    </span>
  );
}
