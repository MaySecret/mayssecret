import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNGN } from "@/lib/format";
import { NIGERIAN_STATES, fetchStateRates } from "@/lib/settings";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [id, setId] = useState<string | null>(null);
  const [shippingFee, setShippingFee] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Per-state delivery rates (editable copy).
  const [rates, setRates] = useState<Record<string, string>>({});
  const [savingRates, setSavingRates] = useState(false);
  const [ratesMsg, setRatesMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
    const map = await fetchStateRates();
    const editable: Record<string, string> = {};
    for (const s of NIGERIAN_STATES) editable[s] = String(map[s] ?? 10000);
    setRates(editable);
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
      setMsg({ type: "ok", text: "Default shipping fee updated." });
      load();
    }
  }

  async function saveRates(e: React.FormEvent) {
    e.preventDefault();
    setRatesMsg(null);
    const updates = NIGERIAN_STATES.map((s) => {
      const v = Number(rates[s]);
      return { state: s, value: v };
    });
    if (updates.some((u) => !Number.isFinite(u.value) || u.value < 0)) {
      setRatesMsg({ type: "err", text: "All state delivery fees must be valid numbers (0 or above)." });
      return;
    }
    setSavingRates(true);
    let failed = false;
    for (const u of updates) {
      const { error } = await supabase
        .from("state_delivery_rates")
        .update({ price: u.value, updated_at: new Date().toISOString() })
        .eq("state", u.state);
      if (error) failed = true;
    }
    setSavingRates(false);
    if (failed) setRatesMsg({ type: "err", text: "Some rates could not be saved. Please retry." });
    else {
      setRatesMsg({ type: "ok", text: "Delivery rates updated for all states." });
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
          <label className="text-xs uppercase tracking-luxe text-muted-foreground">Default shipping fee (NGN)</label>
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
            Fallback used only if a state has no custom rate. Preview: <span className="text-foreground">{formatNGN(preview)}</span>
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

      <form onSubmit={saveRates} className="mt-10 max-w-3xl border border-border bg-card p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-2xl">Delivery rates by state</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a delivery fee for each state. Default is {formatNGN(10000)}; buyers see the rate for their selected state at checkout.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {NIGERIAN_STATES.map((s) => (
            <div key={s}>
              <label className="text-xs uppercase tracking-luxe text-muted-foreground">{s}</label>
              <input
                type="number"
                min="0"
                step="100"
                value={rates[s] ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, [s]: e.target.value }))}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
              />
            </div>
          ))}
        </div>
        {ratesMsg && (
          <p className={`mt-5 text-xs ${ratesMsg.type === "ok" ? "text-accent" : "text-destructive"}`}>{ratesMsg.text}</p>
        )}
        <button
          disabled={savingRates}
          className="mt-6 bg-primary px-6 py-3 text-xs uppercase tracking-luxe text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {savingRates ? "Saving…" : "Save delivery rates"}
        </button>
      </form>
    </div>
  );
}
