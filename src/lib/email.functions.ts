import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Verified domain in Resend.
const FROM = "Mays Secret <support@orddify.com>";
const ADMIN_EMAIL = "support@orddify.com";

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
            Questions? Reply to this email or write to <a href="mailto:${ADMIN_EMAIL}" style="color:#3a1820;">${ADMIN_EMAIL}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const sendEmailSchema = z.object({
  status: z.enum(["placed", "paid", "shipped", "delivered"]),
  orderCode: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  total: z.number().nonnegative(),
  items: z.array(
    z.object({
      product_name: z.string(),
      variant_size: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().nonnegative(),
    }),
  ).min(1),
});

export const sendOrderEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendEmailSchema.parse(input))
  .handler(async ({ data }) => {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.error("[sendOrderEmail] RESEND_API_KEY missing");
      return { sent: false, error: "Email service not configured" };
    }

    const copy = STATUS_COPY[data.status];
    const subject = copy.subject(data.orderCode);

    const customerHtml = renderEmail({
      heading: copy.heading,
      body: copy.body,
      customerName: data.customerName,
      orderCode: data.orderCode,
      items: data.items,
      total: data.total,
    });

    const adminHtml = renderEmail({
      heading: data.status === "placed" ? `New order: ${data.orderCode}` : `Order ${data.orderCode} → ${data.status}`,
      body: `Customer: ${data.customerName} (${data.customerEmail}). Status changed to ${data.status}.`,
      customerName: data.customerName,
      orderCode: data.orderCode,
      items: data.items,
      total: data.total,
      isAdmin: true,
    });

    const sends: Array<{ label: string; promise: Promise<Response> }> = [
      {
        label: "customer",
        promise: fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [data.customerEmail],
            reply_to: ADMIN_EMAIL,
            subject,
            html: customerHtml,
          }),
        }),
      },
    ];

    if (data.status === "placed") {
      sends.push({
        label: "admin",
        promise: fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            to: [ADMIN_EMAIL],
            subject: `[Mays Secret] New order ${data.orderCode} — ${data.customerName}`,
            html: adminHtml,
          }),
        }),
      });
    }

    const results = await Promise.allSettled(sends.map((s) => s.promise));
    const errors: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const label = sends[i].label;
      if (r.status === "rejected") {
        console.error(`[sendOrderEmail] ${label} send threw:`, r.reason);
        errors.push(`${label}: network error`);
      } else if (!r.value.ok) {
        const txt = await r.value.text().catch(() => "");
        console.error(`[sendOrderEmail] ${label} rejected ${r.value.status}:`, txt);
        errors.push(`${label}: ${r.value.status} ${txt.slice(0, 200)}`);
      } else {
        console.log(`[sendOrderEmail] ${label} sent ✓`);
      }
    }

    if (errors.length) return { sent: false, error: errors.join(" | ") };
    return { sent: true };
  });
