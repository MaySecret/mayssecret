import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatNGN } from "@/lib/format";
import { Trash2, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({ meta: [{ title: "Cart — Mays Secret" }] }),
});

function CartPage() {
  const { items, subtotal, count, loading, update, remove } = useCart();
  const { user } = useAuth();

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-20">
        <p className="text-xs uppercase tracking-luxe text-muted-foreground">Your cart</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">
          {count === 0 ? "Empty for now" : `${count} item${count === 1 ? "" : "s"}`}
        </h1>

        {loading ? (
          <p className="mt-12 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="mt-16 border border-border bg-cream/30 p-12 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/shop" className="mt-6 inline-block border-b border-foreground pb-1 text-xs uppercase tracking-luxe">
              Discover fragrances
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              {items.map((it) => (
                <div key={it.variant_id} className="flex gap-5 border-b border-border pb-6">
                  <div className="h-28 w-24 flex-shrink-0 overflow-hidden bg-cream">
                    {it.image && <img src={it.image} alt={it.product_name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link
                      to="/product/$id"
                      params={{ id: it.product_id ?? "" }}
                      className="font-display text-lg hover:text-accent"
                    >
                      {it.product_name}
                    </Link>
                    <p className="text-xs uppercase tracking-luxe text-muted-foreground">{it.size}</p>
                    <p className="mt-1 text-sm">{formatNGN(it.price ?? 0)}</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center border border-border">
                        <button
                          onClick={() => update(it.variant_id, it.quantity - 1)}
                          className="p-2 hover:bg-cream"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-10 text-center text-sm">{it.quantity}</span>
                        <button
                          onClick={() => update(it.variant_id, Math.min(it.quantity + 1, it.stock ?? 99))}
                          disabled={it.quantity >= (it.stock ?? 99)}
                          className="p-2 hover:bg-cream disabled:opacity-30"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(it.variant_id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {formatNGN((it.price ?? 0) * it.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit border border-border bg-cream/40 p-6">
              <p className="text-xs uppercase tracking-luxe text-muted-foreground">Summary</p>
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatNGN(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>Calculated next</span></div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-xl">
                  <span>Total</span>
                  <span>{formatNGN(subtotal)}</span>
                </div>
              </div>
              {user ? (
                <Link
                  to="/checkout"
                  className="mt-6 block w-full bg-primary px-8 py-4 text-center text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90"
                >
                  Checkout
                </Link>
              ) : (
                <Link
                  to="/login"
                  search={{ redirect: "/checkout" }}
                  className="mt-6 block w-full bg-primary px-8 py-4 text-center text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90"
                >
                  Sign in to checkout
                </Link>
              )}
              <p className="mt-3 text-xs text-muted-foreground">An account is required to place an order.</p>
            </aside>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
