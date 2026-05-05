import { Link } from "@tanstack/react-router";
import { Instagram, Facebook } from "lucide-react";
import logo from "@/assets/logo-2.png";

// X (Twitter) icon — simple SVG (lucide doesn't ship X mark)
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.852l-5.366-6.99L4.6 22H1.34l8.06-9.21L1 2h7.04l4.847 6.4L18.244 2zm-2.4 18h1.86L7.24 4H5.27l10.575 16z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      {/* Manifesto */}
      <div className="border-b border-primary-foreground/15">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
          <p className="text-xs uppercase tracking-luxe text-primary-foreground/60">Our promise</p>
          <h2 className="mt-6 max-w-3xl font-display text-4xl leading-[1.1] md:text-6xl">
            We promise more than a perfume. We promise a transformation.<br className="hidden md:block" />
            The moment you wear May's Secret, you aren't just seen, you are remembered.
          </h2>
          <div className="mt-12 flex flex-wrap items-center gap-6">
            <Link
              to="/shop"
              className="inline-flex items-center bg-accent px-7 py-3 text-xs uppercase tracking-luxe text-accent-foreground transition hover:opacity-90"
            >
              Discover the collection
            </Link>
            <a
              href="mailto:hi@mayssecret.org"
              className="text-xs uppercase tracking-luxe text-primary-foreground/80 hover:text-accent transition-colors"
            >
              hi@mayssecret.org →
            </a>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <img src={logo} alt="May's Secret" className="h-12 w-auto brightness-0 invert" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
              A house of fragrances composed slowly, in small batches, for those who believe scent is memory.
            </p>
            {/* Social icons */}
            <div className="mt-6 flex items-center gap-4">
              <a
                href="https://www.instagram.com/mayssecretbrand"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-primary-foreground/70 transition-colors hover:text-accent"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://x.com/mayssecretbrand"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X (Twitter)"
                className="text-primary-foreground/70 transition-colors hover:text-accent"
              >
                <XIcon className="h-4 w-4" />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-primary-foreground/70 transition-colors hover:text-accent"
              >
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="text-sm md:col-span-2">
            <p className="text-xs uppercase tracking-luxe text-primary-foreground/50">Shop</p>
            <ul className="mt-4 space-y-3">
              <li><Link to="/shop" className="hover:text-accent transition-colors">All fragrances</Link></li>
              <li><Link to="/shop" search={{ category: "women" }} className="hover:text-accent transition-colors">For Her</Link></li>
              <li><Link to="/shop" search={{ category: "men" }} className="hover:text-accent transition-colors">For Him</Link></li>
              <li><Link to="/shop" search={{ category: "unisex" }} className="hover:text-accent transition-colors">Unisex</Link></li>
            </ul>
          </div>

          <div className="text-sm md:col-span-3">
            <p className="text-xs uppercase tracking-luxe text-primary-foreground/50">Care</p>
            <ul className="mt-4 space-y-3 text-primary-foreground/80">
              <li>Worldwide delivery</li>
              <li>Secure checkout</li>
              <li>Returns within 14 days</li>
              <li>Authenticity guaranteed</li>
            </ul>
          </div>

          <div className="text-sm md:col-span-3">
            <p className="text-xs uppercase tracking-luxe text-primary-foreground/50">House</p>
            <ul className="mt-4 space-y-3 text-primary-foreground/80">
              <li>Lagos, Nigeria</li>
              <li>Established 2025</li>
              <li>By appointment only</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-primary-foreground/15 pt-8 text-xs uppercase tracking-luxe text-primary-foreground/50 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} May's Secret. All rights reserved.</p>
      
        </div>
      </div>
    </footer>
  );
}
