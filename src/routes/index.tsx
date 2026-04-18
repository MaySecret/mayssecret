import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { formatNGN } from "@/lib/format";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Featured = {
  id: string;
  name: string;
  category: string;
  images: string[];
  min_price: number;
  total_stock: number;
};

function HomePage() {
  const [featured, setFeatured] = useState<Featured[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, category, images, product_variants(price, stock)")
        .eq("featured", true)
        .limit(8);
      if (!data) return;
      setFeatured(
        data.map((p) => {
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
    })();
  }, []);

  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid items-center gap-10 px-5 py-16 md:grid-cols-2 md:gap-0 md:px-0 md:py-0">
          <div className="mx-auto max-w-xl md:px-12 lg:px-20">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">The Mayscent House</p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-7xl">
              Scents that linger<br />long after you leave.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
              A small collection of fragrances, composed slowly and worn with intention.
              Each bottle is a quiet ritual.
            </p>
            <div className="mt-10 flex items-center gap-6">
              <Link
                to="/shop"
                className="inline-flex items-center bg-primary px-7 py-3 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-primary/90"
              >
                Discover the collection
              </Link>
              <Link to="/shop" search={{ category: "unisex" }} className="text-xs uppercase tracking-luxe text-foreground hover:text-gold">
                Bestsellers →
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImg}
              alt="Mayscent signature fragrance bottle bathed in golden light"
              width={1600}
              height={1024}
              className="aspect-[4/5] w-full object-cover md:aspect-auto md:h-[88vh]"
            />
          </div>
        </div>
      </section>

      {/* Category strip */}
      <section className="border-y border-border/60 bg-cream/40">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-border/60 px-5 md:px-8">
          {[
            { label: "For Her", to: "women" },
            { label: "For Him", to: "men" },
            { label: "Unisex", to: "unisex" },
          ].map((c) => (
            <Link
              key={c.to}
              to="/shop"
              search={{ category: c.to }}
              className="py-8 text-center text-xs uppercase tracking-luxe text-muted-foreground transition hover:text-foreground"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">The Collection</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Featured fragrances</h2>
          </div>
          <Link to="/shop" className="hidden text-xs uppercase tracking-luxe text-foreground hover:text-gold md:inline">
            View all →
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 md:gap-x-10 lg:grid-cols-4">
          {featured.map((p) => (
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
                {p.total_stock === 0 && <p className="text-xs uppercase tracking-luxe text-destructive">Sold out</p>}
              </div>
            </Link>
          ))}
          {featured.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Loading the collection…</p>
          )}
        </div>
      </section>

      {/* Story */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-24 text-center md:px-8">
          <p className="text-xs uppercase tracking-luxe text-primary-foreground/60">Our craft</p>
          <h2 className="font-display text-4xl leading-tight md:text-5xl">
            Every Mayscent is composed by hand,<br />in small batches, with rare materials.
          </h2>
        </div>
      </section>
    </SiteShell>
  );
}
