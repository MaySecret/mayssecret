import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";

type Row = {
  product_name: string;
  category: string;
  variant_id: string;
  size: string;
  price: number;
  stock: number;
};

export const Route = createFileRoute("/admin/inventory")({ component: InventoryPage });

function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_variants")
        .select("id, size, price, stock, products(name, category)")
        .order("stock", { ascending: true });
      const out: Row[] = (data ?? []).map((v) => {
        const p = v.products as unknown as { name: string; category: string };
        return {
          product_name: p.name, category: p.category,
          variant_id: v.id, size: v.size, price: Number(v.price), stock: v.stock,
        };
      });
      setRows(out);
    })();
  }, []);

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl">Inventory</h1>
      <div className="mt-8 overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/40 text-left text-xs uppercase tracking-luxe text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Size</th><th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground">No variants yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.variant_id} className="border-t border-border">
                <td className="px-4 py-3">{r.product_name}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{r.category}</td>
                <td className="px-4 py-3">{r.size}</td>
                <td className="px-4 py-3">{formatNGN(r.price)}</td>
                <td className="px-4 py-3">{r.stock}</td>
                <td className="px-4 py-3">
                  {r.stock === 0 ? (
                    <span className="border border-destructive px-2 py-1 text-[10px] uppercase tracking-luxe text-destructive">Out of stock</span>
                  ) : r.stock <= 3 ? (
                    <span className="border border-accent px-2 py-1 text-[10px] uppercase tracking-luxe text-accent-foreground" style={{background:"var(--accent)"}}>Low</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
