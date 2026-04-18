import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Product = {
  id: string;
  name: string;
  category: string;
  featured: boolean;
  product_variants: { id: string; size: string; price: number; stock: number }[];
};

export const Route = createFileRoute("/admin/products")({
  component: ProductsList,
});

function ProductsList() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, category, featured, product_variants(id, size, price, stock)")
      .order("created_at", { ascending: false });
    setItems((data as unknown as Product[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("Delete this product and its variants?")) return;
    await supabase.from("products").delete().eq("id", id);
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Products</h1>
        <Link to="/admin/products/new" className="bg-primary px-5 py-2 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90">
          New product
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/40 text-left text-xs uppercase tracking-luxe text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Variants</th>
              <th className="px-4 py-3">Featured</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={5}>Loading…</td></tr>}
            {!loading && items.length === 0 && <tr><td className="px-4 py-6 text-muted-foreground" colSpan={5}>No products yet.</td></tr>}
            {items.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 capitalize">{p.category}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.product_variants.length}</td>
                <td className="px-4 py-3">{p.featured ? "Yes" : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/admin/products/$id" params={{ id: p.id }} className="mr-4 underline-offset-4 hover:underline">Edit</Link>
                  <button onClick={() => remove(p.id)} className="text-destructive hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
