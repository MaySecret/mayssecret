import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Marquee } from "@/components/site/Marquee";
import { formatNGN } from "@/lib/format";
import heroVideo from "@/assets/hero.mp4";

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
      <section className="relative h-[88vh] min-h-[600px] w-full overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="#"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background/80" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 md:px-12">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-luxe text-foreground/70">The May's Secret House</p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-foreground md:text-7xl lg:text-8xl">
              Scents that linger<br />long after you leave.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/80">
              A small collection of fragrances, composed slowly and worn with intention.
              Each bottle is a quiet ritual.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Link
                to="/shop"
                className="inline-flex items-center bg-primary px-7 py-3 text-xs uppercase tracking-luxe text-primary-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                Discover the collection
              </Link>
              <Link to="/shop" search={{ category: "unisex" }} className="text-xs uppercase tracking-luxe text-foreground hover:text-accent">
                Bestsellers →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Marquee />

      <section className="border-b border-border/60 bg-cream/60">
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

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">The Collection</p>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">Featured fragrances</h2>
          </div>
          <Link to="/shop" className="hidden text-xs uppercase tracking-luxe text-foreground hover:text-accent md:inline">
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

      <section className="bg-accent text-accent-foreground">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-24 text-center md:px-8">
          <p className="text-xs uppercase tracking-luxe text-accent-foreground/70">Our craft</p>
          <h2 className="font-display text-4xl leading-tight md:text-5xl">
            We compose each fragrance the way a secret is kept,<br /> Carefully, deliberately, and only for those who deserve it.
          </h2>
        </div>
      </section>
    </SiteShell>
  );
}
