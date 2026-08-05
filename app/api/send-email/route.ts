import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { sendEmailForUser } from "@/lib/server/mailService";
import { scheduledService } from "@/lib/server/scheduledService";
import { randomUUID } from "crypto";
import { SendEmailRequest } from "@shared/schema";
import { getAuthUser } from "@/lib/server/auth";

async function executeEmailSend(
  input: SendEmailRequest,
  protocol: string,
  host: string,
  userId: string
) {
  const isDuplicate = await storage.checkDuplicateSend(userId, input.companyName, input.email);
  if (isDuplicate) {
    throw new Error("An email was already sent to this company/email within the last 24 hours.");
  }

  const template = await storage.getTemplate(input.templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  // Get user profile for template variables
  const profile = await storage.getProfile(userId);
  const myName = profile?.fullName || "Your Name";
  const myRole = profile?.role || "Software Engineer";
  const myEmail = profile?.email || "";
  const myPhone = profile?.phone || "";
  const myLocation = profile?.location || "";
  const myLinkedin = profile?.linkedinUrl || "";
  const myPortfolio = profile?.portfolioUrl || "";

  const injectVariables = (text: string) =>
    text
      .replace(/\{\{companyName\}\}/g, input.companyName)
      .replace(/\{\{myName\}\}/g, myName)
      .replace(/\{\{myRole\}\}/g, myRole)
      .replace(/\{\{myEmail\}\}/g, myEmail)
      .replace(/\{\{myPhone\}\}/g, myPhone)
      .replace(/\{\{myLocation\}\}/g, myLocation)
      .replace(/\{\{myLinkedin\}\}/g, myLinkedin)
      .replace(/\{\{myPortfolio\}\}/g, myPortfolio)
      .replace(/\{\{customMessage\}\}/g, input.customMessage || "");

  const finalSubject = injectVariables(template.subject);
  const finalHtml = injectVariables(template.content);

  let attachments: { filename: string; content: Buffer }[] = [];
  try {
    const resumeDoc = input.resumeId
      ? await storage.getDocument(input.resumeId)
      : await storage.getDefaultDocument(userId, "Resume");

    if (resumeDoc?.filePath) {
      const fileResp = await fetch(resumeDoc.filePath);
      if (fileResp.ok) {
        const buffer = Buffer.from(await fileResp.arrayBuffer());
        attachments = [{ filename: resumeDoc.fileName, content: buffer }];
      }
    }
  } catch (err) {
    console.error("Failed to fetch resume attachment:", err);
  }

  const now = new Date().toISOString();
  const appRecord = await storage.createApplication(userId, {
    companyName: input.companyName,
    email: input.email,
    templateId: input.templateId,
    status: "Applied",
    sentAt: now,
    updatedAt: now,
    notes: input.customMessage ? `Custom message: ${input.customMessage}` : undefined,
    followUpTemplateId: input.followUpTemplateId ?? null,
    followUpDays: input.followUpDays ?? null,
  });

  const trackingBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const trackingUrl = `${trackingBaseUrl}/api/track/open/${appRecord.id}`;
  // Use a proper 1x1 pixel without display:none (display:none is a spam trigger).
  // The pixel is appended at the very end of the HTML body before the closing tag.
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" border="0" alt="" />`;
  // Insert before </body> if present, otherwise append
  const htmlWithTracking = finalHtml.includes("</body>")
    ? finalHtml.replace("</body>", `${trackingPixel}</body>`)
    : finalHtml + trackingPixel;

  // Generate a plain-text version to reduce spam score (multipart/alternative)
  const plainText = finalHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  try {
    await sendEmailForUser(profile, input.email, finalSubject, htmlWithTracking, attachments as any, plainText);
  } catch (emailErr) {
    console.error("Email send failed:", emailErr);
    await storage.deleteApplication(appRecord.id);
    throw new Error("Failed to send email. Check SMTP credentials in your profile.");
  }
  return appRecord;
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const input = api.email.send.input.parse(body);

    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "localhost";

    if (input.scheduledFor && new Date(input.scheduledFor).getTime() > Date.now()) {
      await scheduledService.add({
        id: randomUUID(),
        ...input,
        scheduledFor: input.scheduledFor as string,
        protocol: protocol,
        host: host,
        userId: user!.id,
      });
      return NextResponse.json({ message: "Email scheduled successfully" }, { status: 202 });
    }

    const appRecord = await executeEmailSend(input, protocol, host, user!.id);
    return NextResponse.json(appRecord, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: err.message || "Internal Error" }, { status: 500 });
  }
}

export { executeEmailSend };
