import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Variant = { id: string; size: string; price: number; stock: number };

export const Route = createFileRoute("/admin/products/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", description: "", category: "unisex" as "unisex"|"men"|"women", images: "", featured: false });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariant, setNewVariant] = useState({ size: "", price: "", stock: "" });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data } = await supabase
      .from("products")
      .select("name, description, category, images, featured, product_variants(id, size, price, stock)")
      .eq("id", id).single();
    if (data) {
      setForm({
        name: data.name, description: data.description, category: data.category,
        images: (data.images ?? []).join("\n"), featured: data.featured,
      });
      const vs = (data.product_variants as Variant[] ?? []).map(v => ({ ...v, price: Number(v.price) }));
      vs.sort((a,b) => parseFloat(a.size) - parseFloat(b.size));
      setVariants(vs);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const images = form.images.split("\n").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("products").update({
      name: form.name, description: form.description, category: form.category,
      featured: form.featured, images,
    }).eq("id", id);
    setMsg(error ? error.message : "Saved");
  }

  async function addVariant() {
    if (!newVariant.size || !newVariant.price) return;
    await supabase.from("product_variants").insert({
      product_id: id, size: newVariant.size,
      price: Number(newVariant.price), stock: Number(newVariant.stock || 0),
    });
    setNewVariant({ size: "", price: "", stock: "" });
    load();
  }

  async function updateVariant(v: Variant) {
    await supabase.from("product_variants").update({ size: v.size, price: v.price, stock: v.stock }).eq("id", v.id);
    load();
  }

  async function removeVariant(vid: string) {
    if (!confirm("Delete this variant?")) return;
    await supabase.from("product_variants").delete().eq("id", vid);
    load();
  }

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 md:p-10">
      <button onClick={() => navigate({ to: "/admin/products" })} className="text-xs uppercase tracking-luxe text-muted-foreground hover:text-foreground">← Back</button>
      <h1 className="mt-3 font-display text-3xl">Edit product</h1>

      <form onSubmit={saveProduct} className="mt-6 max-w-2xl space-y-5">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5}
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as "unisex"|"men"|"women" })}
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm">
            <option value="unisex">Unisex</option><option value="men">Men</option><option value="women">Women</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Image URLs (one per line)</label>
          <textarea value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} rows={3}
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          Featured
        </label>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        <button className="bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90">Save changes</button>
      </form>

      <h2 className="mt-12 font-display text-2xl">Variants</h2>
      <div className="mt-4 overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-cream/40 text-left text-xs uppercase tracking-luxe text-muted-foreground">
            <tr><th className="px-4 py-3">Size</th><th className="px-4 py-3">Price (NGN)</th><th className="px-4 py-3">Stock</th><th></th></tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="px-4 py-2"><input value={v.size} onChange={(e) => setVariants(variants.map(x => x.id === v.id ? { ...x, size: e.target.value } : x))} className="w-24 border border-border bg-background px-2 py-1" /></td>
                <td className="px-4 py-2"><input type="number" value={v.price} onChange={(e) => setVariants(variants.map(x => x.id === v.id ? { ...x, price: Number(e.target.value) } : x))} className="w-32 border border-border bg-background px-2 py-1" /></td>
                <td className="px-4 py-2"><input type="number" value={v.stock} onChange={(e) => setVariants(variants.map(x => x.id === v.id ? { ...x, stock: Number(e.target.value) } : x))} className="w-24 border border-border bg-background px-2 py-1" /></td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => updateVariant(v)} className="mr-3 text-xs uppercase tracking-luxe hover:underline">Save</button>
                  <button onClick={() => removeVariant(v.id)} className="text-xs uppercase tracking-luxe text-destructive hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-border bg-cream/30">
              <td className="px-4 py-2"><input placeholder="50ml" value={newVariant.size} onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })} className="w-24 border border-border bg-background px-2 py-1" /></td>
              <td className="px-4 py-2"><input type="number" placeholder="0" value={newVariant.price} onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })} className="w-32 border border-border bg-background px-2 py-1" /></td>
              <td className="px-4 py-2"><input type="number" placeholder="0" value={newVariant.stock} onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })} className="w-24 border border-border bg-background px-2 py-1" /></td>
              <td className="px-4 py-2 text-right">
                <button onClick={addVariant} className="bg-primary px-4 py-1 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90">Add</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-luxe text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none" />
    </div>
  );
}
