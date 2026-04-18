import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/products/new")({
  component: NewProduct,
});

function NewProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", description: "", category: "unisex" as "unisex" | "men" | "women",
    images: "", featured: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const images = form.images.split("\n").map((s) => s.trim()).filter(Boolean);
    const { data, error } = await supabase.from("products").insert({
      name: form.name, description: form.description, category: form.category,
      featured: form.featured, images,
    }).select("id").single();
    setBusy(false);
    if (error || !data) { setErr(error?.message ?? "Failed"); return; }
    navigate({ to: "/admin/products/$id", params: { id: data.id } });
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl">New product</h1>
      <form onSubmit={submit} className="mt-6 max-w-2xl space-y-5">
        <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Description</label>
          <textarea
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={5}
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as "unisex" | "men" | "women" })}
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
          >
            <option value="unisex">Unisex</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Image URLs (one per line)</label>
          <textarea
            value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })}
            rows={3} placeholder="https://…"
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          Featured on home page
        </label>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <button disabled={busy} className="bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {busy ? "Creating…" : "Create product"}
        </button>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-luxe text-muted-foreground">{label}</label>
      <input
        value={value} required={required} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
      />
    </div>
  );
}
