import nodemailer from "nodemailer";
import type { Profile } from "@shared/schema";

function getTransporterForUser(profile: Profile | null) {
  const host = profile?.smtpHost || process.env.SMTP_HOST || "localhost";
  const port = profile?.smtpPort || parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = profile?.smtpUser || process.env.SMTP_USER;
  const smtpPass = profile?.smtpPass || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    // Disable the default X-Mailer header that nodemailer adds
    // (identifies the mail as sent by automation software)
    xMailer: false,
  } as any);
}

/**
 * Extract the domain portion from an email address.
 * e.g. "user@gmail.com" → "gmail.com"
 */
function getDomain(email: string): string {
  return email.split("@")[1] || "mail.local";
}

/**
 * Convert HTML to a readable plain-text version.
 * This is critical — emails without a text/plain part score high on spam filters.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmailForUser(
  profile: Profile | null,
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[],
  plainText?: string
) {
  const transporter = getTransporterForUser(profile);
  const fromName = profile?.fullName || process.env.MY_NAME || "Outreach";
  const fromEmail = profile?.smtpUser || profile?.email || process.env.SMTP_USER || "noreply@mail.local";
  const domain = getDomain(fromEmail);

  const mailOptions: any = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    // Plain-text alternative is REQUIRED for good deliverability
    text: plainText || htmlToPlainText(html),
    html,
    // replyTo matching sender — tells Gmail this is a real person's email
    replyTo: fromEmail,
    // Generate a proper messageId using the sender's domain
    // (mismatched domains in messageId trigger spam filters)
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`,
    // Envelope ensures the SMTP MAIL FROM matches the header From
    envelope: {
      from: fromEmail,
      to: to,
    },
  };

  // Only add attachments if present (empty attachment arrays can be suspicious)
  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  return transporter.sendMail(mailOptions);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[]
) {
  const transporter = getTransporterForUser(null);
  const fromName = process.env.MY_NAME || "Outreach";
  const fromEmail = process.env.MY_EMAIL || process.env.SMTP_USER || "noreply@mail.local";
  const domain = getDomain(fromEmail);

  const mailOptions: any = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: htmlToPlainText(html),
    html,
    replyTo: fromEmail,
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`,
    envelope: {
      from: fromEmail,
      to: to,
    },
  };

  if (attachments && attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  return transporter.sendMail(mailOptions);
}
