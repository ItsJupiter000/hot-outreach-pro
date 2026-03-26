export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { storage } = await import("@/lib/server/storage");
    const { processFollowUps } = await import("@/lib/server/followUpService");
    const { pollInboxForUser } = await import("@/lib/server/imapService");
    const { runScheduledSends } = await import("@/lib/server/scheduledService");
    const { supabase } = await import("@/lib/server/supabaseClient");

    console.log("[instrumentation] Starting background heartbeat (60s interval)");

    setInterval(async () => {
      try {
        // Run scheduled sends (uses stored userId per email)
        await runScheduledSends("https", process.env.NEXT_PUBLIC_HOST || "localhost:3000");

        // Get all users for per-user tasks
        const { data: users } = await supabase.from("profiles").select("id");
        const now = Date.now();

        for (const user of users ?? []) {
          try {
            const settings = await storage.getSettings(user.id);

            // Follow-ups
            if (settings.followUpsEnabled) {
              const lastRun = settings.lastFollowUpAt
                ? new Date(settings.lastFollowUpAt).getTime()
                : 0;
              const intervalMs = settings.followUpIntervalMinutes * 60 * 1000;
              if (now - lastRun >= intervalMs) {
                await processFollowUps(user.id);
                await storage.updateSettings(user.id, { lastFollowUpAt: new Date().toISOString() });
              }
            }

            // Scheduling
            if (settings.schedulingEnabled) {
              const lastRun = settings.lastSchedulingAt
                ? new Date(settings.lastSchedulingAt).getTime()
                : 0;
              const intervalMs = settings.schedulingIntervalMinutes * 60 * 1000;
              if (now - lastRun >= intervalMs) {
                await storage.updateSettings(user.id, { lastSchedulingAt: new Date().toISOString() });
              }
            }

            // Reply polling (per-user SMTP credentials)
            if (settings.replyPollingEnabled) {
              const lastRun = settings.lastReplyPollingAt
                ? new Date(settings.lastReplyPollingAt).getTime()
                : 0;
              const intervalMs = settings.replyPollingIntervalMinutes * 60 * 1000;
              if (now - lastRun >= intervalMs) {
                await pollInboxForUser(user.id);
                await storage.updateSettings(user.id, { lastReplyPollingAt: new Date().toISOString() });
              }
            }
          } catch (err) {
            console.error(`[heartbeat] Error for user ${user.id}:`, err);
          }
        }
      } catch (err) {
        console.error("[heartbeat] Error:", err);
      }
    }, 60000);
  }
}
