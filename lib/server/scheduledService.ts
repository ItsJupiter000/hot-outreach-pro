import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { SendEmailRequest } from "@shared/schema";
import { storage } from "./storage";

export type ScheduledEmail = SendEmailRequest & {
  id: string;
  scheduledFor: string;
  templateName?: string;
  host?: string;
  protocol?: string;
  userId?: string;
};

export class ScheduledService {
  private filePath: string;

  constructor() {
    this.filePath = path.join(process.cwd(), "persistent_data", "scheduled_emails.json");
    
    // Ensure dir exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Ensure file exists
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([]));
    }
  }

  async getAll(): Promise<ScheduledEmail[]> {
    try {
      const data = fs.readFileSync(this.filePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async add(email: ScheduledEmail): Promise<void> {
    const emails = await this.getAll();
    emails.push(email);
    fs.writeFileSync(this.filePath, JSON.stringify(emails, null, 2));
  }

  async remove(id: string): Promise<void> {
    let emails = await this.getAll();
    emails = emails.filter(e => e.id !== id);
    fs.writeFileSync(this.filePath, JSON.stringify(emails, null, 2));
  }

  async popDueEmails(): Promise<ScheduledEmail[]> {
    const emails = await this.getAll();
    const now = new Date().getTime();
    
    const due = emails.filter(e => new Date(e.scheduledFor).getTime() <= now);
    const pending = emails.filter(e => new Date(e.scheduledFor).getTime() > now);
    
    if (due.length > 0) {
      fs.writeFileSync(this.filePath, JSON.stringify(pending, null, 2));
    }
    
    return due;
  }
}

export const scheduledService = new ScheduledService();

export async function runScheduledSends(protocol: string, host: string) {
  try {
    const dueEmails = await scheduledService.popDueEmails();
    if (dueEmails.length > 0) {
      console.log(`Heartbeat: Sending ${dueEmails.length} scheduled emails.`);
    }
    for (const email of dueEmails) {
      try {
        const { executeEmailSend } = await import("@/app/api/send-email/route");
        await executeEmailSend(email, email.protocol || protocol, email.host || host, email.userId || "");
        if (email.userId) {
          await storage.updateSettings(email.userId, { lastSchedulingAt: new Date().toISOString() });
        }
      } catch (e) {
        console.error(`Error sending scheduled email to ${email.email}:`, e);
      }
    }
  } catch (err) {
    console.error("Error processing scheduled emails:", err);
  }
}
