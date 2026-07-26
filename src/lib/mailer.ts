import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "no-reply@example.com";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // Dev fallback: log instead of sending so local/dev environments without
    // a Resend API key still function.
    console.log(`[mailer] (no RESEND_API_KEY) to=${to} subject="${subject}"\n${html}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

export async function sendMagicLinkEmail(to: string, url: string) {
  await send(
    to,
    "Your customer portal sign-in link",
    `<p>Click the link below to access your customer portal:</p><p><a href="${url}">${url}</a></p><p>This link expires in 15 minutes.</p>`
  );
}

export async function sendInvoiceEmail(to: string, invoiceNumber: string, url: string) {
  await send(
    to,
    `Invoice ${invoiceNumber} from your restoration shop`,
    `<p>Your invoice ${invoiceNumber} is ready.</p><p><a href="${url}">View invoice</a></p>`
  );
}

export async function sendEstimateEmail(to: string, projectName: string, url: string) {
  await send(
    to,
    `Estimate ready for ${projectName}`,
    `<p>An estimate for <strong>${projectName}</strong> is ready for your review.</p><p><a href="${url}">View estimate</a></p>`
  );
}

export async function sendPurchaseOrderEmail(to: string, poNumber: string, vendorName: string) {
  await send(
    to,
    `Purchase Order ${poNumber}`,
    `<p>Purchase order ${poNumber} has been sent to ${vendorName}.</p>`
  );
}
