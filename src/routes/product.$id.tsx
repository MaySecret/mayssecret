import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/product/$id")({
  component: ProductPage,
});

type Variant = { id: string; size: string; price: number; stock: number };
type Product = {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  product_variants: Variant[];
};

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, description, images, category, product_variants(id, size, price, stock)")
        .eq("id", id)
        .single();
      if (data) {
        const p = data as unknown as Product;
        p.product_variants.sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
        setProduct(p);
        setVariantId(p.product_variants[0]?.id ?? null);
      }
    })();
  }, [id]);

  const selected = useMemo(
    () => product?.product_variants.find((v) => v.id === variantId) ?? null,
    [product, variantId],
  );

  if (!product) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-7xl px-5 py-24 text-center text-sm text-muted-foreground md:px-8">
          Loading…
        </div>
      </SiteShell>
    );
  }

  const outOfStock = !selected || selected.stock === 0;

  async function addToCart() {
    if (!selected) return;
    setAdding(true);
    await add(selected.id, qty);
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  async function buyNow() {
    if (!selected) return;
    await add(selected.id, qty);
    navigate({ to: "/cart" });
  }

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 md:grid-cols-2 md:gap-16 md:px-8 md:py-20">
        <div>
          <div className="aspect-[4/5] overflow-hidden bg-cream">
            <img
              src={product.images[activeImg] ?? product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`h-20 w-16 overflow-hidden border ${i === activeImg ? "border-foreground" : "border-border"}`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:pt-6">
          <p className="text-xs uppercase tracking-luxe text-muted-foreground">{product.category}</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">{product.name}</h1>
          <p className="mt-5 font-display text-3xl text-primary">
            {selected ? formatNGN(selected.price) : "—"}
          </p>
          <p className="mt-2 text-xs uppercase tracking-luxe">
            {outOfStock ? (
              <span className="text-destructive">Out of stock</span>
            ) : selected!.stock <= 3 ? (
              <span className="text-accent">Only {selected!.stock} left</span>
            ) : (
              <span className="text-muted-foreground">In stock</span>
            )}
          </p>

          <p className="mt-8 leading-relaxed text-foreground/85">{product.description}</p>

          <div className="mt-10">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">Size</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.product_variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  disabled={v.stock === 0}
                  className={`border px-5 py-3 text-sm transition ${
                    variantId === v.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground"
                  } ${v.stock === 0 ? "opacity-40 line-through" : ""}`}
                >
                  {v.size}
                </button>
              ))}
            </div>
          </div>

          {!outOfStock && (
            <div className="mt-8 flex items-center gap-4">
              <p className="text-xs uppercase tracking-luxe text-muted-foreground">Quantity</p>
              <div className="flex items-center border border-border">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-lg">−</button>
                <span className="min-w-10 text-center">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(selected!.stock, q + 1))}
                  className="px-3 py-2 text-lg"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3">
            <button
              onClick={addToCart}
              disabled={outOfStock || adding}
              className="w-full border border-foreground bg-background px-8 py-4 text-xs uppercase tracking-luxe text-foreground transition hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {outOfStock ? "Out of stock" : adding ? "Adding…" : added ? "Added ✓" : "Add to cart"}
            </button>
            <button
              onClick={buyNow}
              disabled={outOfStock}
              className="w-full bg-primary px-8 py-4 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {outOfStock ? "Out of stock" : "Buy Now"}
            </button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
