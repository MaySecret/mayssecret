import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CartItem = {
  variant_id: string;
  quantity: number;
  // Hydrated for display
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
  guestId: string;
  add: (variantId: string, qty?: number) => Promise<void>;
  update: (variantId: string, qty: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  clear: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CartCtx | undefined>(undefined);
const STORAGE_KEY = "ms_cart_v2";
const GUEST_KEY = "ms_guest_id_v1";

function readLocal(): { variant_id: string; quantity: number }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeLocal(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))),
  );
}
function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

async function hydrate(items: { variant_id: string; quantity: number }[]): Promise<CartItem[]> {
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
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestId, setGuestId] = useState("");

  const refresh = useCallback(async () => {
    const hydrated = await hydrate(readLocal());
    setItems(hydrated);
  }, []);

  useEffect(() => {
    setGuestId(getOrCreateGuestId());
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function add(variantId: string, qty = 1) {
    const local = readLocal();
    const idx = local.findIndex((i) => i.variant_id === variantId);
    if (idx >= 0) local[idx].quantity += qty;
    else local.push({ variant_id: variantId, quantity: qty });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    await refresh();
  }

  async function update(variantId: string, qty: number) {
    if (qty <= 0) return remove(variantId);
    const local = readLocal();
    const idx = local.findIndex((i) => i.variant_id === variantId);
    if (idx >= 0) {
      local[idx].quantity = qty;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    }
    await refresh();
  }

  async function remove(variantId: string) {
    const local = readLocal().filter((i) => i.variant_id !== variantId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    await refresh();
  }

  function clear() {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  }

  // Avoid unused var warning; the map writer is local to refresh path.
  void writeLocal;

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0);

  return (
    <Ctx.Provider value={{ items, count, subtotal, loading, guestId, add, update, remove, clear, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
