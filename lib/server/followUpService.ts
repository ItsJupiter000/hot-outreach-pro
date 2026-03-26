import { storage } from "./storage";
import { sendEmailForUser } from "./mailService";

export async function sendSingleFollowUp(app: any, userId: string) {
  const settings = await storage.getSettings(userId);
  const templateId = app.followUpTemplateId || settings.followUpTemplateId;
  
  if (!templateId) {
    console.warn(`Follow-up service: No template configured for app ${app.id} (global or individual).`);
    return;
  }

  const template = await storage.getTemplate(templateId);
  if (!template) {
    console.warn(`Follow-up service: Template ${templateId} not found, skipping.`);
    return;
  }

  const profile = await storage.getProfile(userId);
  const myName = profile?.fullName || "Your Name";
  const myRole = profile?.role || "Software Engineer";

  const injectVariables = (text: string) =>
    text
      .replace(/\{\{companyName\}\}/g, app.companyName)
      .replace(/\{\{myName\}\}/g, myName)
      .replace(/\{\{myRole\}\}/g, myRole)
      .replace(/\{\{myEmail\}\}/g, profile?.email || "")
      .replace(/\{\{myPhone\}\}/g, profile?.phone || "")
      .replace(/\{\{myLocation\}\}/g, profile?.location || "")
      .replace(/\{\{myLinkedin\}\}/g, profile?.linkedinUrl || "")
      .replace(/\{\{myPortfolio\}\}/g, profile?.portfolioUrl || "")
      .replace(/\{\{customMessage\}\}/g, "");

  const subject = injectVariables(template.subject);
  const html = injectVariables(template.content);

  // Attach default resume if available
  let attachments: { filename: string; content: Buffer }[] = [];
  try {
    const resumeDoc = await storage.getDefaultDocument(userId, "Resume");
    if (resumeDoc?.filePath) {
      const fileResp = await fetch(resumeDoc.filePath);
      if (fileResp.ok) {
        const buffer = Buffer.from(await fileResp.arrayBuffer());
        attachments = [{ filename: resumeDoc.fileName, content: buffer }];
      }
    }
  } catch (e) {
    console.error("Follow-up service: Could not fetch resume attachment:", e);
  }

  await sendEmailForUser(profile, app.email, subject, html, attachments as any);
  await storage.markFollowUpSent(app.id);
  await storage.updateApplication(app.id, { status: "Follow-up Sent" });
  console.log(`Follow-up service: Sent follow-up to ${app.email} for ${app.companyName}.`);
}

export async function processFollowUps(userId: string) {
  try {
    const duApps = await storage.getApplicationsDueForFollowUp(userId);
    if (duApps.length === 0) {
      return;
    }
    console.log(`Follow-up cron: Found ${duApps.length} follow-up(s) to send.`);

    for (const app of duApps) {
      try {
        await sendSingleFollowUp(app, userId);
      } catch (err) {
        console.error(`Follow-up cron: Failed to send follow-up for app ${app.id}:`, err);
      }
    }
  } catch (err) {
    console.error("Follow-up cron: Error during follow-up processing:", err);
  }
}
