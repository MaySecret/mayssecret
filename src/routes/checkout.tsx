import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { fetchSiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — May's Secret" }] }),
});

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().min(7, "Valid phone required").max(20).regex(/^[+\d\s\-()]+$/, "Invalid phone"),
  email: z.string().trim().email("Valid email required").max(255),
  address: z.string().trim().min(10, "Full delivery address required").max(500),
});

const PROFILE_KEY = "ms_checkout_profile_v1";

function readProfile() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { return null; }
}

function CheckoutPage() {
  const { items, subtotal, count, loading: cartLoading, guestId } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [shipping, setShipping] = useState<number>(0);
  const [shippingLoading, setShippingLoading] = useState(true);

  // Prefill from saved profile (last checkout)
  useEffect(() => {
    const p = readProfile();
    if (p) setForm((f) => ({ ...f, ...p }));
  }, []);

  // Fetch shipping fee
  useEffect(() => {
    fetchSiteSettings().then((s) => {
      setShipping(s.shipping_fee);
      setShippingLoading(false);
    });
  }, []);

  // Redirect if cart empty
  useEffect(() => {
    if (!cartLoading && items.length === 0 && !submitting) {
      navigate({ to: "/cart" });
    }
  }, [items, cartLoading, navigate, submitting]);

  const total = subtotal + shipping;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    // Save for prefill next time
    if (typeof window !== "undefined") {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(parsed.data));
    }

    const { data, error } = await supabase.functions.invoke("place-order", {
      body: {
        ...parsed.data,
        guest_id: guestId,
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      },
    });

    if (error || !data?.order_id) {
      setSubmitting(false);
      const msg = (data as any)?.error || error?.message || "Could not place order. Please try again.";
      setErrors({ form: msg });
      return;
    }

    // Redirect to Kora checkout if URL is provided
    if (data.checkout_url) {
      window.location.href = data.checkout_url;
      return;
    }

    // Fallback: go to success page (e.g., zero-amount or no payment URL)
    navigate({ to: "/order/success", search: { ref: data.order_code } });
  }

  if (cartLoading || shippingLoading) {
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
            <Field label="Full name" value={form.customer_name} onChange={(v) => setForm({ ...form, customer_name: v })} error={errors.customer_name} />
            <Field label="Phone number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} error={errors.phone} placeholder="+234 ..." />
            <Field label="Email address" value={form.email} onChange={(v) => setForm({ ...form, email: v })} error={errors.email} placeholder="you@example.com" />
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
              disabled={submitting || items.length === 0}
              className="w-full bg-primary px-8 py-4 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Redirecting to payment…" : `Pay now — ${formatNGN(total)}`}
            </button>
            <p className="text-xs text-muted-foreground">
              Payment is processed securely via Kora. You'll receive a confirmation email immediately after payment.
            </p>
          </form>

          <aside className="border border-border bg-cream/40 p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-luxe text-muted-foreground">Order summary</p>
              <Link to="/cart" className="text-xs uppercase tracking-luxe text-muted-foreground hover:text-foreground">Edit</Link>
            </div>
            <div className="mt-6 space-y-4">
              {items.map((it) => (
                <div key={it.variant_id} className="flex gap-3">
                  <div className="h-16 w-14 flex-shrink-0 overflow-hidden bg-background">
                    {it.image && <img src={it.image} alt={it.product_name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-display">{it.product_name}</p>
                    <p className="text-xs uppercase tracking-luxe text-muted-foreground">{it.size} · Qty {it.quantity}</p>
                  </div>
                  <p className="text-sm">{formatNGN((it.price ?? 0) * it.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({count})</span><span>{formatNGN(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping fee</span><span>{formatNGN(shipping)}</span></div>
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
