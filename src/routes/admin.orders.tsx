import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";
import { sendOrderEmail } from "@/lib/email.functions";

type Order = {
  id: string; order_code: string; customer_name: string; phone: string; address: string; email: string;
  total_price: number; payment_status: "pending"|"paid"|"failed"; delivery_status: "processing"|"shipped"|"delivered";
  created_at: string;
  order_items: { product_name: string; variant_size: string; quantity: number; price: number }[];
};

export const Route = createFileRoute("/admin/orders")({ component: OrdersPage });

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("id, order_code, customer_name, phone, address, total_price, payment_status, delivery_status, created_at, order_items(product_name, variant_size, quantity, price)")
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function emailFor(id: string, status: "paid" | "shipped" | "delivered") {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    sendOrderEmail({
      data: {
        status,
        orderCode: o.order_code,
        customerName: o.customer_name,
        customerEmail: (o as unknown as { email?: string }).email ?? "",
        total: Number(o.total_price),
        items: o.order_items.map((it) => ({
          product_name: it.product_name,
          variant_size: it.variant_size,
          quantity: it.quantity,
          price: Number(it.price),
        })),
      },
    }).catch((e) => console.error("Email failed:", e));
  }
  async function setDelivery(id: string, status: Order["delivery_status"]) {
    await supabase.from("orders").update({ delivery_status: status }).eq("id", id);
    if (status === "shipped" || status === "delivered") emailFor(id, status);
    load();
  }
  async function setPayment(id: string, status: Order["payment_status"]) {
    await supabase.from("orders").update({ payment_status: status }).eq("id", id);
    if (status === "paid") emailFor(id, "paid");
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl">Orders</h1>

      <div className="mt-8 space-y-3">
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        {orders.map((o) => (
          <div key={o.id} className="border border-border bg-card">
            <button
              onClick={() => setOpen(open === o.id ? null : o.id)}
              className="grid w-full grid-cols-2 items-center gap-4 px-4 py-3 text-left text-sm md:grid-cols-6"
            >
              <div className="font-mono text-xs">{o.order_code}</div>
              <div>{o.customer_name}</div>
              <div className="text-muted-foreground hidden md:block">{o.phone}</div>
              <div>{formatNGN(Number(o.total_price))}</div>
              <Badge label={o.payment_status} />
              <Badge label={o.delivery_status} muted />
            </button>
            {open === o.id && (
              <div className="space-y-4 border-t border-border bg-cream/30 px-4 py-4 text-sm">
                <div><span className="text-xs uppercase tracking-luxe text-muted-foreground">Address: </span>{o.address}</div>
                <div><span className="text-xs uppercase tracking-luxe text-muted-foreground">Phone: </span>{o.phone}</div>
                <div>
                  <p className="text-xs uppercase tracking-luxe text-muted-foreground">Items</p>
                  <ul className="mt-1 space-y-1">
                    {o.order_items.map((it, i) => (
                      <li key={i}>{it.product_name} — {it.variant_size} × {it.quantity} ({formatNGN(it.price * it.quantity)})</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Action label="Mark paid" onClick={() => setPayment(o.id, "paid")} />
                  <Action label="Mark failed" onClick={() => setPayment(o.id, "failed")} />
                  <Action label="Processing" onClick={() => setDelivery(o.id, "processing")} />
                  <Action label="Shipped" onClick={() => setDelivery(o.id, "shipped")} />
                  <Action label="Delivered" onClick={() => setDelivery(o.id, "delivered")} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className={`inline-block w-fit border px-2 py-1 text-[10px] uppercase tracking-luxe ${muted ? "border-border text-muted-foreground" : "border-foreground"}`}>
      {label}
    </span>
  );
}
function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="border border-border bg-background px-3 py-1 text-xs uppercase tracking-luxe hover:border-foreground">{label}</button>;
}
