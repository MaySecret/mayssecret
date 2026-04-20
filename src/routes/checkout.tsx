import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Checkout — Mays Secret" }] }),
});

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().min(7, "Valid phone required").max(20).regex(/^[+\d\s\-()]+$/, "Invalid phone"),
  email: z.string().trim().email("Valid email required").max(255),
  address: z.string().trim().min(10, "Full delivery address required").max(500),
});

function CheckoutPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { items, subtotal, count, clear, loading: cartLoading } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({ customer_name: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", search: { redirect: "/checkout" } });
    }
  }, [user, authLoading, navigate]);

  // Prefill from profile + auth email
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      customer_name: f.customer_name || profile?.display_name || "",
      phone: f.phone || profile?.phone || "",
      email: f.email || user.email || "",
      address: f.address || profile?.address || "",
    }));
  }, [user, profile]);

  // Redirect if cart empty (after load)
  useEffect(() => {
    if (!cartLoading && user && items.length === 0 && !submitting) {
      navigate({ to: "/cart" });
    }
  }, [items, cartLoading, user, navigate, submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0 || !user) return;
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    // Save to profile (so it prefills next time)
    await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: parsed.data.customer_name,
          phone: parsed.data.phone,
          address: parsed.data.address,
        },
        { onConflict: "user_id" },
      );
    refreshProfile();

    // Call place-order edge function (validates stock, computes total, creates order, clears cart, sends email)
    const { data, error } = await supabase.functions.invoke("place-order", {
      body: {
        ...parsed.data,
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      },
    });

    if (error || !data?.id) {
      setSubmitting(false);
      const msg = (data as any)?.error || error?.message || "Could not place order. Please try again.";
      setErrors({ form: msg });
      return;
    }

    // Cart is cleared server-side; mirror locally
    await clear();
    navigate({ to: "/order/success", search: { id: data.id } });
  }

  if (authLoading || !user) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl px-5 py-24 text-sm text-muted-foreground md:px-8">Loading…</div>
      </SiteShell>
    );
  }

  if (cartLoading) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl px-5 py-24 text-sm text-muted-foreground md:px-8">Loading cart…</div>
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
              {submitting ? "Placing order…" : `Place order — ${formatNGN(subtotal)}`}
            </button>
            <p className="text-xs text-muted-foreground">
              Payment is processed securely. You will receive a confirmation email immediately.
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
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Calculated after</span></div>
              <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-xl">
                <span>Total</span>
                <span>{formatNGN(subtotal)}</span>
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
