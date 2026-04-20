import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type CartItem = {
  variant_id: string;
  quantity: number;
  // Hydrated client-side for display:
  product_id?: string;
  product_name?: string;
  size?: string;
  price?: number;
  stock?: number;
  image?: string;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  loading: boolean;
  add: (variantId: string, qty?: number) => Promise<void>;
  update: (variantId: string, qty: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CartCtx | undefined>(undefined);
const STORAGE_KEY = "ms_cart_v1";

function readLocal(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))));
}

async function hydrate(items: CartItem[]): Promise<CartItem[]> {
  if (items.length === 0) return [];
  const ids = items.map((i) => i.variant_id);
  const { data } = await supabase
    .from("product_variants")
    .select("id, size, price, stock, product_id, products(name, images)")
    .in("id", ids);
  const map = new Map<string, CartItem>();
  (data ?? []).forEach((v: any) => {
    const prod = v.products as { name: string; images: string[] } | null;
    map.set(v.id, {
      variant_id: v.id,
      quantity: 0,
      product_id: v.product_id,
      product_name: prod?.name ?? "",
      size: v.size,
      price: Number(v.price),
      stock: v.stock,
      image: prod?.images?.[0] ?? "",
    });
  });
  return items
    .map((i) => {
      const m = map.get(i.variant_id);
      return m ? { ...m, quantity: i.quantity } : null;
    })
    .filter(Boolean) as CartItem[];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartId, setCartId] = useState<string | null>(null);
  const [mergedFor, setMergedFor] = useState<string | null>(null);

  // Initial load + auth changes
  useEffect(() => {
    if (authLoading) return;
    (async () => {
      setLoading(true);
      if (user) {
        // Get/create cart
        let { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).maybeSingle();
        if (!cart) {
          const { data: newCart } = await supabase
            .from("carts")
            .insert({ user_id: user.id })
            .select("id")
            .single();
          cart = newCart;
        }
        setCartId(cart!.id);

        // Merge guest cart on first login
        if (mergedFor !== user.id) {
          const guest = readLocal();
          if (guest.length > 0) {
            for (const g of guest) {
              const { data: existing } = await supabase
                .from("cart_items")
                .select("id, quantity")
                .eq("cart_id", cart!.id)
                .eq("variant_id", g.variant_id)
                .maybeSingle();
              if (existing) {
                await supabase
                  .from("cart_items")
                  .update({ quantity: existing.quantity + g.quantity })
                  .eq("id", existing.id);
              } else {
                await supabase
                  .from("cart_items")
                  .insert({ cart_id: cart!.id, variant_id: g.variant_id, quantity: g.quantity });
              }
            }
            localStorage.removeItem(STORAGE_KEY);
          }
          setMergedFor(user.id);
        }

        const { data: rows } = await supabase
          .from("cart_items")
          .select("variant_id, quantity")
          .eq("cart_id", cart!.id);
        const hydrated = await hydrate((rows ?? []) as CartItem[]);
        setItems(hydrated);
      } else {
        setCartId(null);
        const local = readLocal();
        const hydrated = await hydrate(local);
        setItems(hydrated);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Realtime sync for logged-in users
  useEffect(() => {
    if (!cartId) return;
    const ch = supabase
      .channel(`cart:${cartId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items", filter: `cart_id=eq.${cartId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId]);

  async function refresh() {
    if (user && cartId) {
      const { data: rows } = await supabase
        .from("cart_items")
        .select("variant_id, quantity")
        .eq("cart_id", cartId);
      const hydrated = await hydrate((rows ?? []) as CartItem[]);
      setItems(hydrated);
    } else {
      const hydrated = await hydrate(readLocal());
      setItems(hydrated);
    }
  }

  async function add(variantId: string, qty = 1) {
    if (user && cartId) {
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cartId)
        .eq("variant_id", variantId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + qty })
          .eq("id", existing.id);
      } else {
        await supabase.from("cart_items").insert({ cart_id: cartId, variant_id: variantId, quantity: qty });
      }
    } else {
      const local = readLocal();
      const idx = local.findIndex((i) => i.variant_id === variantId);
      if (idx >= 0) local[idx].quantity += qty;
      else local.push({ variant_id: variantId, quantity: qty });
      writeLocal(local);
    }
    await refresh();
  }

  async function update(variantId: string, qty: number) {
    if (qty <= 0) return remove(variantId);
    if (user && cartId) {
      await supabase.from("cart_items").update({ quantity: qty }).eq("cart_id", cartId).eq("variant_id", variantId);
    } else {
      const local = readLocal();
      const idx = local.findIndex((i) => i.variant_id === variantId);
      if (idx >= 0) {
        local[idx].quantity = qty;
        writeLocal(local);
      }
    }
    await refresh();
  }

  async function remove(variantId: string) {
    if (user && cartId) {
      await supabase.from("cart_items").delete().eq("cart_id", cartId).eq("variant_id", variantId);
    } else {
      writeLocal(readLocal().filter((i) => i.variant_id !== variantId));
    }
    await refresh();
  }

  async function clear() {
    if (user && cartId) {
      await supabase.from("cart_items").delete().eq("cart_id", cartId);
    } else {
      writeLocal([]);
    }
    setItems([]);
  }

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, count, subtotal, loading, add, update, remove, clear, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
