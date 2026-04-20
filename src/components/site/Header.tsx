import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import logo from "@/assets/logo-1.png";
import { useCart } from "@/lib/cart";

export function Header() {
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link to="/" className="flex items-center" aria-label="May's Secret home">
          <img src={logo} alt="May's Secret" className="h-10 w-auto md:h-12" />
        </Link>
        <nav className="hidden items-center gap-10 text-xs uppercase tracking-luxe text-muted-foreground md:flex">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">Home</Link>
          <Link to="/shop" activeProps={{ className: "text-foreground" }} className="hover:text-foreground transition-colors">Shop</Link>
          <Link to="/shop" search={{ category: "men" }} className="hover:text-foreground transition-colors">Men</Link>
          <Link to="/shop" search={{ category: "women" }} className="hover:text-foreground transition-colors">Women</Link>
          <Link to="/shop" search={{ category: "unisex" }} className="hover:text-foreground transition-colors">Unisex</Link>
        </nav>
        <div className="flex items-center gap-5">
          <Link to="/cart" className="relative text-foreground hover:text-accent transition-colors" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
