import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const FROM = "Mays Secret <pelumi@orddify.com>";
const ADMIN_EMAIL = "pelumi@orddify.com";

const STATUS_COPY: Record<string, { subject: (code: string) => string; heading: string; body: string }> = {
  placed: {
    subject: (c) => `Your Mays Secret order ${c} is confirmed`,
    heading: "Thank you for your order",
    body: "We've received your order and we're preparing it with care. You'll hear from us again the moment payment clears.",
  },
  paid: {
    subject: (c) => `Payment received for order ${c}`,
    heading: "Payment confirmed",
    body: "Your payment has been received. Your fragrance is now being prepared for shipment.",
  },
  shipped: {
    subject: (c) => `Your Mays Secret order ${c} is on its way`,
    heading: "Your order has shipped",
    body: "Your fragrance is on its way to you. Keep an eye on your inbox — we'll let you know once it arrives.",
  },
  delivered: {
    subject: (c) => `Your Mays Secret order ${c} has arrived`,
    heading: "Delivered with love",
    body: "Your order has been delivered. We hope every spray feels like a small ritual. Thank you for choosing Mays Secret.",
  },
};

type Item = { product_name: string; variant_size: string; quantity: number; price: number };

function renderEmail(opts: {
  heading: string;
  body: string;
  customerName: string;
  orderCode: string;
  items: Item[];
  total: number;
  isAdmin?: boolean;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
  const itemsHtml = opts.items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eedde4;color:#3a1820;font-family:Georgia,serif;">
          ${it.product_name} <span style="color:#8a5260;">— ${it.variant_size} × ${it.quantity}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eedde4;text-align:right;color:#3a1820;font-family:Georgia,serif;">
          ${fmt(it.price * it.quantity)}
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${opts.heading}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #f0d8e1;">
        <tr><td style="background:#3a1820;padding:32px;text-align:center;">
          <h1 style="margin:0;font-family:Georgia,serif;font-weight:400;font-size:32px;color:#f7c6d9;letter-spacing:-0.01em;">Mays Secret</h1>
        </td></tr>
        <tr><td style="padding:40px 32px 16px;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#8a5260;">${opts.isAdmin ? "New Order" : "Order Update"}</p>
          <h2 style="margin:0 0 20px;font-family:Georgia,serif;font-weight:400;font-size:28px;color:#3a1820;line-height:1.2;">${opts.heading}</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5a3540;">Dear ${opts.customerName},</p>
          <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#5a3540;">${opts.body}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eedde4;border-bottom:1px solid #eedde4;">
            <tr><td style="padding:16px 0;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#8a5260;">Order ${opts.orderCode}</td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            ${itemsHtml}
            <tr><td style="padding:20px 0 0;font-family:Georgia,serif;font-size:20px;color:#3a1820;">Total</td>
                <td style="padding:20px 0 0;text-align:right;font-family:Georgia,serif;font-size:20px;color:#3a1820;">${fmt(opts.total)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;background:#fbeef3;text-align:center;">
          <p style="margin:0;font-size:12px;color:#8a5260;line-height:1.6;">
            Mays Secret · Lagos, Nigeria<br>
            Questions? Reply to this email or write to <a href="mailto:pelumi@orddify.com" style="color:#3a1820;">pelumi@orddify.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const sendEmailSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["placed", "paid", "shipped", "delivered"]),
});

export const sendOrderEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendEmailSchema.parse(input))
  .handler(async ({ data }) => {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!RESEND_API_KEY) {
      console.error("[sendOrderEmail] RESEND_API_KEY missing");
      return { sent: false, error: "Email service not configured" };
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[sendOrderEmail] Supabase server credentials missing");
      return { sent: false, error: "Server not configured" };
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, order_code, customer_name, email, total_price, order_items(product_name, variant_size, quantity, price)",
      )
      .eq("id", data.orderId)
      .single();

    if (error || !order) {
      console.error("[sendOrderEmail] order lookup failed", error);
      return { sent: false, error: "Order not found" };
    }

    const copy = STATUS_COPY[data.status];
    const items = (order.order_items as Item[]) ?? [];
    const subject = copy.subject(order.order_code);

    const customerHtml = renderEmail({
      heading: copy.heading,
      body: copy.body,
      customerName: order.customer_name,
      orderCode: order.order_code,
      items,
      total: Number(order.total_price),
    });

    const adminHtml = renderEmail({
      heading: data.status === "placed" ? `New order: ${order.order_code}` : `Order ${order.order_code} → ${data.status}`,
      body: `Customer: ${order.customer_name} (${order.email}). Status changed to ${data.status}.`,
      customerName: order.customer_name,
      orderCode: order.order_code,
      items,
      total: Number(order.total_price),
      isAdmin: true,
    });

    const sends: Array<Promise<Response>> = [];

    if (order.email) {
      sends.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [order.email],
            reply_to: ADMIN_EMAIL,
            subject,
            html: customerHtml,
          }),
        }),
      );
    }

    // Notify admin only on placed orders to avoid noise
    if (data.status === "placed") {
      sends.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [ADMIN_EMAIL],
            subject: `[Mays Secret] New order ${order.order_code} — ${order.customer_name}`,
            html: adminHtml,
          }),
        }),
      );
    }

    const results = await Promise.allSettled(sends);
    const failures = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
    if (failures.length) {
      for (const f of failures) {
        if (f.status === "fulfilled") {
          const txt = await f.value.text().catch(() => "");
          console.error("[sendOrderEmail] Resend rejected:", f.value.status, txt);
        } else {
          console.error("[sendOrderEmail] send failed:", f.reason);
        }
      }
      return { sent: false, error: "One or more emails failed to send" };
    }

    return { sent: true };
  });
