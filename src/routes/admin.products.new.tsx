import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products/new")({
  component: NewProduct,
});

type VariantDraft = { size: string; price: string; stock: string };

function NewProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "unisex" as "unisex" | "men" | "women",
    featured: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([
    { size: "50ml", price: "", stock: "0" },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    const valid = list.filter((f) => f.type.startsWith("image/") && f.size <= 5_000_000);
    if (valid.length !== list.length) {
      toast.error("Some files were skipped (must be images under 5MB)");
    }
    setFiles((prev) => [...prev, ...valid]);
    setPreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
  }

  function removeImage(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function setVariant(idx: number, patch: Partial<VariantDraft>) {
    setVariants((vs) => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }
  function addVariant() {
    setVariants((vs) => [...vs, { size: "", price: "", stock: "0" }]);
  }
  function removeVariant(idx: number) {
    setVariants((vs) => (vs.length === 1 ? vs : vs.filter((_, i) => i !== idx)));
  }

  async function uploadImages(productId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (!form.name.trim()) return setErr("Product name is required");
    if (files.length === 0) return setErr("Upload at least one image");
    const cleanVariants = variants
      .map((v) => ({ size: v.size.trim(), price: Number(v.price), stock: Number(v.stock || 0) }))
      .filter((v) => v.size && v.price > 0);
    if (cleanVariants.length === 0) return setErr("Add at least one variant with size and price");

    setBusy(true);
    try {
      const { data: product, error: pErr } = await supabase
        .from("products")
        .insert({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          featured: form.featured,
          images: [],
        })
        .select("id")
        .single();
      if (pErr || !product) throw pErr ?? new Error("Failed to create product");

      const images = await uploadImages(product.id);
      const { error: uErr } = await supabase
        .from("products")
        .update({ images })
        .eq("id", product.id);
      if (uErr) throw uErr;

      const { error: vErr } = await supabase
        .from("product_variants")
        .insert(cleanVariants.map((v) => ({ ...v, product_id: product.id })));
      if (vErr) throw vErr;

      toast.success("Product created");
      navigate({ to: "/admin/products" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create product");
      setBusy(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <button
        type="button"
        onClick={() => navigate({ to: "/admin/products" })}
        className="text-xs uppercase tracking-luxe text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>
      <h1 className="mt-3 font-display text-3xl">New product</h1>

      <form onSubmit={submit} className="mt-6 max-w-3xl space-y-8">
        <section className="space-y-5">
          <Input
            label="Product name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <div>
            <label className="text-xs uppercase tracking-luxe text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-luxe text-muted-foreground">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as "unisex" | "men" | "women" })
              }
              className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
            >
              <option value="unisex">Unisex</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            Featured on home page
          </label>
        </section>

        <section>
          <p className="text-xs uppercase tracking-luxe text-muted-foreground">Images</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload one or more product photos (max 5MB each).</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative h-28 w-24 overflow-hidden border border-border bg-cream/40">
                <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute right-1 top-1 bg-foreground/80 px-1 text-[10px] text-background"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="flex h-28 w-24 cursor-pointer items-center justify-center border border-dashed border-border bg-cream/30 text-xs uppercase tracking-luxe text-muted-foreground hover:border-foreground">
              <input type="file" accept="image/*" multiple onChange={onPickFiles} className="hidden" />
              + Add
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-luxe text-muted-foreground">Variants</p>
            <button
              type="button"
              onClick={addVariant}
              className="border border-border px-3 py-1 text-xs uppercase tracking-luxe hover:border-foreground"
            >
              + Add variant
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 border border-border bg-cream/30 p-3">
                <div className="col-span-4">
                  <label className="text-[10px] uppercase tracking-luxe text-muted-foreground">Size</label>
                  <input
                    value={v.size}
                    onChange={(e) => setVariant(i, { size: e.target.value })}
                    placeholder="50ml"
                    className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] uppercase tracking-luxe text-muted-foreground">Price (NGN)</label>
                  <input
                    type="number"
                    min="0"
                    value={v.price}
                    onChange={(e) => setVariant(i, { price: e.target.value })}
                    placeholder="0"
                    className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase tracking-luxe text-muted-foreground">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) => setVariant(i, { stock: e.target.value })}
                    className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    disabled={variants.length === 1}
                    className="text-xs text-destructive hover:underline disabled:opacity-30"
                    aria-label="Remove variant"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {err && <p className="text-xs text-destructive">{err}</p>}
        <button
          disabled={busy}
          className="bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create product"}
        </button>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-luxe text-muted-foreground">{label}</label>
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
      />
    </div>
  );
}
