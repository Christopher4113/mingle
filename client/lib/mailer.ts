// lib/mailer.ts
import nodemailer from "nodemailer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Creates a single re-used transporter. Keep this file on the Node runtime.
 * Do NOT mark routes that import this as `edge`; Nodemailer needs Node APIs.
 */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,            // SSL
  secure: true,         // true for 465
  auth: {
    user: process.env.SMTP_USER, // your Gmail address
    pass: process.env.SMTP_PASS, // Gmail App Password (not your login pwd)
  },
});

/** Quick text fallback generator */
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string; // default “Mingle”
};

export async function sendMail({ to, subject, html, text, fromName = "Mingle" }: SendArgs) {
  const from = `${fromName} <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;

  // Verify transporter once in dev (optional)
  // await transporter.verify();

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text ?? stripHtml(html),
  });
}

/**
 * Email for notifications with a CTA button.
 * Produces both HTML and text automatically.
 */
export async function sendNotificationEmail(opts: {
  to: string;
  notificationId: string;
  title: string;
  message: string;
}) {
  const { to, notificationId, title, message } = opts;

  // Deep link to a single notification page:
  // You can render a page at /notifications/[id] that fetches the item.
  const url = `${APP_URL}/notifications/${encodeURIComponent(notificationId)}`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.6; color:#0f172a; background:#f8fafc; padding:24px;">
    <table width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08)">
      <tr>
        <td style="padding:24px 24px 8px; background:linear-gradient(135deg,#4F46E5 0%, #EC4899 100%); color:white;">
          <h1 style="margin:0; font-size:20px;">${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px;">${message}</p>
          <p style="margin:16px 0 24px;">Click below to view this notification in Mingle.</p>
          <a href="${url}" style="display:inline-block; padding:12px 18px; background:#4F46E5; color:#fff; text-decoration:none; border-radius:10px; font-weight:600;">
            View notification
          </a>
          <p style="margin-top:24px; font-size:12px; color:#475569;">
            If you’re not signed in, you’ll be asked to log in first and then we’ll take you right there.
          </p>
        </td>
      </tr>
    </table>
  </div>
  `;

  await sendMail({
    to,
    subject: title,
    html,
  });
}
