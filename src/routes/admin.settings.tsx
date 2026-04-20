import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [id, setId] = useState<string | null>(null);
  const [shippingFee, setShippingFee] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function load() {
    const { data } = await supabase
      .from("site_settings")
      .select("id, shipping_fee")
      .limit(1)
      .maybeSingle();
    if (data) {
      setId(data.id);
      setShippingFee(String(Number(data.shipping_fee)));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const fee = Number(shippingFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setMsg({ type: "err", text: "Enter a valid shipping fee (0 or above)." });
      return;
    }
    setSaving(true);
    const { error } = id
      ? await supabase.from("site_settings").update({ shipping_fee: fee }).eq("id", id)
      : await supabase.from("site_settings").insert({ shipping_fee: fee });
    setSaving(false);
    if (error) setMsg({ type: "err", text: error.message });
    else {
      setMsg({ type: "ok", text: "Shipping fee updated." });
      load();
    }
  }

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  const preview = Number(shippingFee || 0);

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Store-wide configuration.</p>

      <form onSubmit={save} className="mt-8 max-w-md space-y-5 border border-border bg-card p-6">
        <div>
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Shipping fee (NGN)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-foreground focus:outline-none"
            required
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Applied once per order, regardless of quantity. Preview: <span className="text-foreground">{formatNGN(preview)}</span>
          </p>
        </div>
        {msg && (
          <p className={`text-xs ${msg.type === "ok" ? "text-accent" : "text-destructive"}`}>{msg.text}</p>
        )}
        <button
          disabled={saving}
          className="bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
