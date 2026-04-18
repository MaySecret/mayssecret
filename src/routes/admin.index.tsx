import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({
    products: 0, orders: 0, pending: 0, revenue: 0, lowStock: 0,
  });

  useEffect(() => {
    (async () => {
      const [{ count: products }, ordersRes, variantsRes] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("total_price, payment_status"),
        supabase.from("product_variants").select("stock"),
      ]);
      const orders = ordersRes.data ?? [];
      const variants = variantsRes.data ?? [];
      setStats({
        products: products ?? 0,
        orders: orders.length,
        pending: orders.filter((o) => o.payment_status === "pending").length,
        revenue: orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + Number(o.total_price), 0),
        lowStock: variants.filter((v) => v.stock <= 3).length,
      });
    })();
  }, []);

  const cards = [
    { label: "Products", value: stats.products },
    { label: "Orders", value: stats.orders },
    { label: "Pending payment", value: stats.pending },
    { label: "Revenue (paid)", value: formatNGN(stats.revenue) },
    { label: "Low stock variants", value: stats.lowStock },
  ];

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Overview of your Mayscent store.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="border border-border bg-cream/30 p-6">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">{c.label}</p>
            <p className="mt-3 font-display text-3xl">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
