export function Footer() {
  return (
    <footer className="mt-32 border-t border-border/60 bg-cream/40">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-display text-3xl">Mayscent<span className="text-gold">.</span></p>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Fragrances composed for the moments that linger.
            </p>
          </div>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">Care</p>
            <ul className="mt-3 space-y-2">
              <li>Worldwide delivery</li>
              <li>Secure checkout</li>
              <li>support@mayscent.com</li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">House</p>
            <ul className="mt-3 space-y-2">
              <li>Lagos, Nigeria</li>
              <li>Est. 2025</li>
            </ul>
          </div>
        </div>
        <p className="mt-12 text-xs text-muted-foreground">© {new Date().getFullYear()} Mayscent. All rights reserved.</p>
      </div>
    </footer>
  );
}
