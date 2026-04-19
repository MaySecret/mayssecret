export function Marquee() {
  const items = Array.from({ length: 5 }, (_, i) => i);
  return (
    <div className="overflow-hidden border-y border-border/60 bg-primary py-6 text-primary-foreground">
      <div className="flex w-max animate-marquee whitespace-nowrap will-change-transform">
        {[...items, ...items].map((_, i) => (
          <span
            key={i}
            className="mx-12 font-display text-2xl uppercase tracking-luxe md:text-4xl"
            aria-hidden={i >= items.length}
          >
            Every Scent Tells A Secret
            <span className="mx-12 text-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
