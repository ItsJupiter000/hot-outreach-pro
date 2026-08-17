/**
 * Next.js instrumentation hook. Runs ONCE per server process, at boot, before
 * the first request is served.
 *
 * That timing is why config validation and signal handlers belong here: a bad
 * ConfigMap should produce a pod that never becomes ready (visible as
 * CrashLoopBackOff with a readable message), not a pod that serves 500s at 3am
 * on the first cron tick.
 */
export async function register() {
  // ⚠️ EVERY dynamic import below MUST stay INLINE inside this `if` block.
  //
  // Next.js bundles instrumentation.ts for BOTH the nodejs and edge runtimes,
  // and it replaces `process.env.NEXT_RUNTIME` with a string literal at build
  // time per runtime. In the edge build this becomes `if ("edge" === "nodejs")`,
  // which webpack proves is dead and eliminates — taking the imports with it.
  //
  // That elimination is the only thing keeping Node-only code out of the edge
  // bundle. Two refactors that LOOK equivalent both break the production build:
  //
  //   if (process.env.NEXT_RUNTIME !== "nodejs") return;   // early return
  //   ...imports at function top level
  //
  //   if (process.env.NEXT_RUNTIME === "nodejs") await registerNode();  // helper
  //
  // Both fail with (confirmed, not theorised):
  //   ./lib/server/storage.ts        Can't resolve 'crypto'
  //   ./app/api/send-email/route.ts  Can't resolve 'crypto'
  //   ./node_modules/imapflow/...    Can't resolve 'stream'
  //   Import trace: ./instrumentation.ts
  //
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate configuration first. Throws on invalid config, which is the
    // desired behaviour — fail at boot, loudly, in one place.
    const { env } = await import("@/lib/server/env");

    const { installShutdownHandlers, onBeforeExit, trackJob, isDraining } =
      await import("@/lib/server/shutdown");

    installShutdownHandlers();

    if (!env.ENABLE_INPROCESS_SCHEDULER) {
      console.log(
        "[instrumentation] In-process scheduler DISABLED " +
          "(ENABLE_INPROCESS_SCHEDULER=false). Background work must be driven " +
          "externally via GET /api/cron."
      );
      return;
    }

    const { storage } = await import("@/lib/server/storage");
    const { processFollowUps } = await import("@/lib/server/followUpService");
    const { pollInboxForUser } = await import("@/lib/server/imapService");
    const { runScheduledSends } = await import("@/lib/server/scheduledService");
    const { supabase } = await import("@/lib/server/supabaseClient");

    console.log("[instrumentation] Starting background heartbeat (60s interval)");

    // ⚠️ KNOWN LIMITATION — removed in Stage 6.
    //
    // This runs in every server process with no distributed lock. It is safe on
    // the single-replica EC2 deployment and UNSAFE at replicas > 1: the
    // settings.last*At guards below are read-then-written, so concurrent
    // replicas all observe the same stale timestamp, all pass the interval
    // check, and all send. See docs/devops/README.md, "The three blockers".
    const timer = setInterval(async () => {
      // Stop starting new work the moment shutdown begins. In-flight work is
      // awaited by the shutdown handler; new work would just be abandoned.
      if (isDraining()) return;

      await trackJob(
        (async () => {
          try {
            // NEXT_PUBLIC_HOST is dead config: it exists in no .env file, and
            // its only purpose was building tracking-pixel URLs, which were
            // deliberately removed for deliverability (see
            // app/api/send-email/route.ts:99-100). Both parameters disappear in
            // Stage 6, so it is not worth routing through env.ts to delete it.
            // eslint-disable-next-line no-restricted-properties
            const host = process.env.NEXT_PUBLIC_HOST || "localhost:3000";
            await runScheduledSends("https", host);

            const { data: users } = await supabase.from("profiles").select("id");
            const now = Date.now();

            for (const user of users ?? []) {
              if (isDraining()) return;
              try {
                const settings = await storage.getSettings(user.id);

                if (settings.followUpsEnabled) {
                  const lastRun = settings.lastFollowUpAt
                    ? new Date(settings.lastFollowUpAt).getTime()
                    : 0;
                  const intervalMs = settings.followUpIntervalMinutes * 60 * 1000;
                  if (now - lastRun >= intervalMs) {
                    await processFollowUps(user.id);
                    await storage.updateSettings(user.id, {
                      lastFollowUpAt: new Date().toISOString(),
                    });
                  }
                }

                if (settings.schedulingEnabled) {
                  const lastRun = settings.lastSchedulingAt
                    ? new Date(settings.lastSchedulingAt).getTime()
                    : 0;
                  const intervalMs = settings.schedulingIntervalMinutes * 60 * 1000;
                  if (now - lastRun >= intervalMs) {
                    await storage.updateSettings(user.id, {
                      lastSchedulingAt: new Date().toISOString(),
                    });
                  }
                }

                if (settings.replyPollingEnabled) {
                  const lastRun = settings.lastReplyPollingAt
                    ? new Date(settings.lastReplyPollingAt).getTime()
                    : 0;
                  const intervalMs = settings.replyPollingIntervalMinutes * 60 * 1000;
                  if (now - lastRun >= intervalMs) {
                    await pollInboxForUser(user.id);
                    await storage.updateSettings(user.id, {
                      lastReplyPollingAt: new Date().toISOString(),
                    });
                  }
                }
              } catch (err) {
                console.error(`[heartbeat] Error for user ${user.id}:`, err);
              }
            }
          } catch (err) {
            console.error("[heartbeat] Error:", err);
          }
        })()
      );
    }, 60000);

    // Without this, SIGTERM leaves the interval armed and the process is killed
    // wherever the current tick happens to be — potentially mid-SMTP-handshake.
    onBeforeExit(() => {
      clearInterval(timer);
      console.log("[instrumentation] heartbeat stopped");
    });
  }
}
