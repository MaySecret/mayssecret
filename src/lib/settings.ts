import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  shipping_fee: number;
};

const FALLBACK: SiteSettings = { shipping_fee: 10000 };

export const DEFAULT_SHIPPING = 10000;

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
  "FCT (Abuja)",
] as const;

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("shipping_fee")
    .limit(1)
    .maybeSingle();
  if (error || !data) return FALLBACK;
  return { shipping_fee: Number(data.shipping_fee) };
}

// Returns a map of state -> delivery price (NGN). Used by the checkout to show
// the live price the admin has set, and by the admin editor to prefill values.
export async function fetchStateRates(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("state_delivery_rates")
    .select("state, price");
  const map: Record<string, number> = {};
  if (!error && data) {
    for (const row of data as { state: string; price: number }[]) {
      map[row.state] = Number(row.price);
    }
  }
  return map;
}
