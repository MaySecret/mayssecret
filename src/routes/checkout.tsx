import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";
import { sendOrderEmail } from "@/lib/email";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    variantId: String(search.variantId ?? ""),
    qty: Math.max(1, Number(search.qty) || 1),
  }),
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — Mays Secret" }] }),
});

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().min(7, "Valid phone required").max(20).regex(/^[+\d\s\-()]+$/, "Invalid phone"),
  email: z.string().trim().email("Valid email required").max(255),
  address: z.string().trim().min(10, "Full delivery address required").max(500),
});

type Detail = {
  variant_id: string;
  product_id: string;
  product_name: string;
  size: string;
  price: number;
  stock: number;
  image: string;
};

function CheckoutPage() {
  const { variantId, qty } = Route.useSearch();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!variantId) {
      navigate({ to: "/shop" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("product_variants")
        .select("id, size, price, stock, product_id, products(name, images)")
        .eq("id", variantId)
        .single();
      if (data) {
        const prod = data.products as unknown as { name: string; images: string[] };
        setDetail({
          variant_id: data.id,
          product_id: data.product_id,
          product_name: prod.name,
          size: data.size,
          price: Number(data.price),
          stock: data.stock,
          image: prod.images?.[0] ?? "",
        });
      }
    })();
  }, [variantId, navigate]);

  const total = detail ? detail.price * qty : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    // Create order (status pending) — payment integration (Flutterwave) happens on Pay step.
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: parsed.data.customer_name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        address: parsed.data.address,
        total_price: total,
      })
      .select("id, order_code")
      .single();

    if (error || !order) {
      setSubmitting(false);
      setErrors({ form: "Could not place order. Please try again." });
      return;
    }

    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: detail.product_id,
      variant_id: detail.variant_id,
      product_name: detail.product_name,
      variant_size: detail.size,
      quantity: qty,
      price: detail.price,
    });

    // Fire confirmation email (customer + admin notification). Don't block UX on failure.
    sendOrderEmail({
      status: "placed",
      orderCode: order.order_code,
      customerName: parsed.data.customer_name,
      customerEmail: parsed.data.email,
      total,
      items: [
        {
          product_name: detail.product_name,
          variant_size: detail.size,
          quantity: qty,
          price: detail.price,
        },
      ],
    })
      .then((r) => console.log("[checkout] sendOrderEmail result:", r))
      .catch((e) => console.error("[checkout] sendOrderEmail failed:", e));

    // Flutterwave will be wired here. For now we mark as pending and route to success.
    navigate({ to: "/order/success", search: { id: order.id } });
  }

  if (!detail) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl px-5 py-24 text-sm text-muted-foreground md:px-8">Loading…</div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
        <p className="text-xs uppercase tracking-luxe text-muted-foreground">Checkout</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">Complete your order</h1>

        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_400px]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Field
              label="Full name"
              value={form.customer_name}
              onChange={(v) => setForm({ ...form, customer_name: v })}
              error={errors.customer_name}
            />
            <Field
              label="Phone number"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              error={errors.phone}
              placeholder="+234 ..."
            />
            <Field
              label="Email address"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              error={errors.email}
              placeholder="you@example.com"
            />
            <div>
              <label className="text-xs uppercase tracking-luxe text-muted-foreground">Delivery address</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={4}
                className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
              />
              {errors.address && <p className="mt-1 text-xs text-destructive">{errors.address}</p>}
            </div>

            {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary px-8 py-4 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Processing…" : `Pay ${formatNGN(total)}`}
            </button>
            <p className="text-xs text-muted-foreground">
              Payment is processed securely via Flutterwave. You will be redirected after order confirmation.
            </p>
          </form>

          <aside className="border border-border bg-cream/40 p-6">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">Order summary</p>
            <div className="mt-6 flex gap-4">
              <div className="h-24 w-20 overflow-hidden bg-background">
                {detail.image && <img src={detail.image} alt={detail.product_name} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg">{detail.product_name}</h3>
                <p className="text-xs uppercase tracking-luxe text-muted-foreground">{detail.size}</p>
                <p className="mt-1 text-sm">Qty {qty}</p>
              </div>
              <p className="text-sm">{formatNGN(detail.price * qty)}</p>
            </div>
            <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNGN(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Calculated after</span></div>
              <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-xl">
                <span>Total</span>
                <span>{formatNGN(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}

function Field({
  label, value, onChange, error, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-luxe text-muted-foreground">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
