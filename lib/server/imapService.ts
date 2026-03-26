import { ImapFlow } from "imapflow";
import { storage } from "./storage";
import { supabase } from "./supabaseClient";
import type { Profile } from "@shared/schema";

/**
 * Poll inbox for a specific user using their SMTP/IMAP credentials from profile.
 */
export async function pollInboxForUser(userId: string) {
  const profile = await storage.getProfile(userId);
  if (!profile) return;

  const smtpUser = profile.smtpUser || process.env.SMTP_USER;
  const smtpPass = profile.smtpPass || process.env.SMTP_PASS;
  const smtpHost = profile.smtpHost || process.env.SMTP_HOST || "imap.gmail.com";

  if (!smtpUser || !smtpPass) {
    console.log(`IMAP: Missing SMTP credentials for user ${userId}, skipping inbox poll.`);
    return;
  }

  // Convert smtp host to imap host
  let imapHost = smtpHost;
  if (imapHost.startsWith("smtp.")) {
    imapHost = imapHost.replace("smtp.", "imap.");
  }

  const client = new ImapFlow({
    host: imapHost,
    port: 993,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    logger: false,
  });

  try {
    await client.connect();
    
    const lock = await client.getMailboxLock("INBOX");
    try {
      const messages = client.fetch({ seen: false }, { envelope: true });
      
      // Get this user's active applications
      const { data: allAppsData } = await supabase
        .from("applications")
        .select("id, email")
        .eq("user_id", userId)
        .in("status", ["Applied", "Opened"]);
      
      const activeApps = (allAppsData ?? []).map((row: any) => ({
        id: row.id,
        email: row.email,
      }));

      if (activeApps.length === 0) return;
      
      for await (const message of messages) {
        if (!message.envelope) continue;
        const fromAddrs = message.envelope.from;
        if (!fromAddrs || fromAddrs.length === 0) continue;
        
        for (const addr of fromAddrs) {
          if (addr.address) {
            const incomingEmail = addr.address.toLowerCase();
            const matchingApps = activeApps.filter((a: any) => a.email.toLowerCase() === incomingEmail);
            
            for (const app of matchingApps) {
              await storage.updateApplication(app.id, { status: "Replied" });
              console.log(`IMAP: Detected reply from ${incomingEmail}. Updated App ${app.id} to Replied!`);
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`IMAP Polling Error for user ${userId}:`, err);
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore logout errors
    }
  }
}

/**
 * Legacy global poll (uses env vars as fallback). 
 * Prefer pollInboxForUser() for per-user polling.
 */
export async function pollInbox() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || "imap.gmail.com";

  if (!user || !pass) {
    // No global SMTP configured — this is expected in multi-user mode
    return;
  }

  let imapHost = host;
  if (imapHost.startsWith("smtp.")) {
    imapHost = imapHost.replace("smtp.", "imap.");
  }

  const client = new ImapFlow({
    host: imapHost,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const messages = client.fetch({ seen: false }, { envelope: true });
      
      const { data: allAppsData } = await supabase
        .from("applications")
        .select("id, email")
        .in("status", ["Applied", "Opened"]);
      
      const activeApps = (allAppsData ?? []).map((row: any) => ({
        id: row.id,
        email: row.email,
      }));
      
      for await (const message of messages) {
        if (!message.envelope) continue;
        const fromAddrs = message.envelope.from;
        if (!fromAddrs || fromAddrs.length === 0) continue;
        
        for (const addr of fromAddrs) {
          if (addr.address) {
            const incomingEmail = addr.address.toLowerCase();
            const matchingApps = activeApps.filter((a: any) => a.email.toLowerCase() === incomingEmail);
            for (const app of matchingApps) {
              await storage.updateApplication(app.id, { status: "Replied" });
              console.log(`IMAP: Detected reply from ${incomingEmail}. Updated App ${app.id} to Replied!`);
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("IMAP Polling Error:", err);
  } finally {
    try { await client.logout(); } catch (e) { }
  }
}
