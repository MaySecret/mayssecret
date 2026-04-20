import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  shipping_fee: number;
};

const FALLBACK: SiteSettings = { shipping_fee: 2500 };

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("shipping_fee")
    .limit(1)
    .maybeSingle();
  if (error || !data) return FALLBACK;
  return { shipping_fee: Number(data.shipping_fee) };
}
