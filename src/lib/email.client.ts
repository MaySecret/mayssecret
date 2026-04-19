import { supabase } from "@/integrations/supabase/client";

export type OrderEmailPayload = {
  status: "placed" | "paid" | "shipped" | "delivered";
  orderCode: string;
  customerName: string;
  customerEmail: string;
  total: number;
  items: Array<{
    product_name: string;
    variant_size: string;
    quantity: number;
    price: number;
  }>;
};

export async function sendOrderEmail(payload: OrderEmailPayload) {
  const { data, error } = await supabase.functions.invoke("send-order-email", {
    body: payload,
  });
  if (error) {
    console.error("[sendOrderEmail] invoke error:", error);
    return { sent: false, error: error.message };
  }
  return data as { sent: boolean; error?: string };
}
