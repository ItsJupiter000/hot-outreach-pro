import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { processFollowUps } from "@/lib/server/followUpService";
import { pollInboxForUser } from "@/lib/server/imapService";
import { runScheduledSends } from "@/lib/server/scheduledService";
import { supabase } from "@/lib/server/supabaseClient";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all users to iterate through
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id");
    
    if (usersError) throw new Error(usersError.message);
    
    const now = Date.now();
    const results: string[] = [];

    // Run scheduled sends (not user-specific, uses stored userId per email)
    await runScheduledSends("https", request.headers.get("host") || "localhost");
    results.push("scheduling");

    // Process follow-ups and reply polling per user
    for (const user of users ?? []) {
      try {
        const settings = await storage.getSettings(user.id);

        if (settings.followUpsEnabled) {
          const lastRun = settings.lastFollowUpAt
            ? new Date(settings.lastFollowUpAt).getTime()
            : 0;
          const intervalMs = settings.followUpIntervalMinutes * 60 * 1000;
          if (now - lastRun >= intervalMs) {
            await processFollowUps(user.id);
            await storage.updateSettings(user.id, { lastFollowUpAt: new Date().toISOString() });
            results.push(`followUps:${user.id}`);
          }
        }

        if (settings.replyPollingEnabled) {
          const lastRun = settings.lastReplyPollingAt
            ? new Date(settings.lastReplyPollingAt).getTime()
            : 0;
          const intervalMs = settings.replyPollingIntervalMinutes * 60 * 1000;
          if (now - lastRun >= intervalMs) {
            await pollInboxForUser(user.id);
            await storage.updateSettings(user.id, { lastReplyPollingAt: new Date().toISOString() });
            results.push(`replyPolling:${user.id}`);
          }
        }
      } catch (err) {
        console.error(`Cron: Error processing user ${user.id}:`, err);
      }
    }

    return NextResponse.json({
      message: "Cron executed",
      processed: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
