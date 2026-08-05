import nodemailer from "nodemailer";
import type { Profile } from "@shared/schema";

const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
};

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
  });
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
  const fromName = profile?.fullName || "Job Bot";
  const fromEmail = profile?.smtpUser || profile?.email || "bot@local.dev";

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    // Always include plain-text alternative — reduces spam score significantly
    text: plainText || html.replace(/<[^>]+>/g, "").trim(),
    html,
    attachments,
    headers: {
      // Helps prevent being flagged as bulk/automated mail
      "X-Priority": "3",
      "X-Mailer": "",          // suppress default nodemailer X-Mailer header
      "Mime-Version": "1.0",
    },
  });
}

export async function sendEmail(to: string, subject: string, html: string, attachments?: { filename: string, path: string }[]) {
  const transporter = getTransporter();
  const fromName = process.env.MY_NAME || "Job Bot";
  const fromEmail = process.env.MY_EMAIL || process.env.SMTP_USER || "bot@local.dev";

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    attachments,
  });

  return info;
}
