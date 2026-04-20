import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";

type Cat = "all" | "men" | "women" | "unisex";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: (search.category as Cat) || "all",
  }),
  component: ShopPage,
  head: () => ({
    meta: [
      { title: "Shop — May's Secret" },
      { name: "description", content: "Browse the complete May's Secret fragrance collection." },
    ],
  }),
});

type Item = {
  id: string;
  name: string;
  category: string;
  images: string[];
  min_price: number;
  total_stock: number;
};

function ShopPage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("products")
        .select("id, name, category, images, product_variants(price, stock)")
        .order("created_at", { ascending: false });
      if (category !== "all") q = q.eq("category", category);
      const { data } = await q;
      setItems(
        (data ?? []).map((p) => {
          const variants = (p.product_variants as { price: number; stock: number }[]) ?? [];
          return {
            id: p.id,
            name: p.name,
            category: p.category,
            images: p.images,
            min_price: variants.length ? Math.min(...variants.map((v) => Number(v.price))) : 0,
            total_stock: variants.reduce((s, v) => s + v.stock, 0),
          };
        }),
      );
      setLoading(false);
    })();
  }, [category]);

  const cats: { label: string; value: Cat }[] = [
    { label: "All", value: "all" },
    { label: "Women", value: "women" },
    { label: "Men", value: "men" },
    { label: "Unisex", value: "unisex" },
  ];

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
        <div className="text-center">
          <p className="text-xs uppercase tracking-luxe text-muted-foreground">The collection</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl">Shop fragrances</h1>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {cats.map((c) => (
            <button
              key={c.value}
              onClick={() => navigate({ search: { category: c.value } })}
              className={`border px-5 py-2 text-xs uppercase tracking-luxe transition ${
                category === c.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 md:gap-x-10 lg:grid-cols-4">
          {loading && <p className="col-span-full text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground">No fragrances in this category yet.</p>
          )}
          {items.map((p) => (
            <Link key={p.id} to="/product/$id" params={{ id: p.id }} className="group">
              <div className="aspect-[4/5] overflow-hidden bg-cream">
                <img
                  src={p.images[0] ?? "/src/assets/sample-1.jpg"}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-xs uppercase tracking-luxe text-muted-foreground">{p.category}</p>
                <h3 className="font-display text-xl">{p.name}</h3>
                <p className="text-sm text-foreground/80">From {formatNGN(p.min_price)}</p>
                {p.total_stock === 0 ? (
                  <p className="text-xs uppercase tracking-luxe text-destructive">Out of stock</p>
                ) : (
                  <p className="text-xs uppercase tracking-luxe text-muted-foreground">In stock</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
