import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Square Notes <onboarding@resend.dev>";

export const emailConfigured = Boolean(apiKey);

/**
 * Sends through Resend when a key is configured. Without one the message is
 * logged instead, so the reset and verification flows are testable end to end
 * in development and simply start delivering once the key is added.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!apiKey) {
    console.info(
      `\n[email] RESEND_API_KEY is not set, so this was not sent.\n  to: ${to}\n  subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}\n`,
    );
    return { delivered: false as const };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) throw new Error(error.message);
  return { delivered: true as const };
}

const shell = (heading: string, body: string, button: { href: string; label: string }) => `
<div style="background:#0a0a0a;padding:32px;font-family:ui-sans-serif,system-ui,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#131316;border:1px solid #232326;border-radius:16px;padding:28px">
    <p style="margin:0 0 4px;color:#6d6d76;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Square Notes</p>
    <h1 style="margin:0 0 12px;color:#ededed;font-size:20px">${heading}</h1>
    <p style="margin:0 0 20px;color:#a1a1aa;font-size:14px;line-height:1.6">${body}</p>
    <a href="${button.href}" style="display:inline-block;background:#ededed;color:#0a0a0a;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;text-decoration:none">${button.label}</a>
    <p style="margin:20px 0 0;color:#6d6d76;font-size:12px;line-height:1.6">If the button does not work, paste this into your browser:<br>${button.href}</p>
  </div>
</div>`;

export function resetPasswordEmail(link: string) {
  return {
    subject: "Reset your Square Notes password",
    html: shell(
      "Reset your password",
      "Use the link below to choose a new password. It expires in one hour and can only be used once. If you didn't ask for this, you can ignore this email.",
      { href: link, label: "Choose a new password" },
    ),
    text: `Reset your Square Notes password using this link (valid for one hour, single use):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

export function verifyEmailEmail(link: string) {
  return {
    subject: "Confirm your email for Square Notes",
    html: shell(
      "Confirm your email",
      "Confirming your address means we can help you back into your account if you ever forget your password.",
      { href: link, label: "Confirm my email" },
    ),
    text: `Confirm your email for Square Notes:\n${link}`,
  };
}
