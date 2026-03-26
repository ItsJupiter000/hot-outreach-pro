"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

/**
 * Client-side heartbeat that triggers follow-ups, scheduled sends,
 * and inbox polling at user-configured intervals.
 * Runs only while the browser tab is active.
 */
export function useHeartbeat() {
  const queryClient = useQueryClient();
  const followUpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const schedulingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replyPollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 60000, // re-check settings every minute
  });

  const runSync = useCallback(async (feature: string) => {
    try {
      const res = await fetch("/api/settings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ feature }),
      });
      if (res.ok) {
        // Refresh settings to update lastRunAt timestamps
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        // Refresh relevant data
        if (feature === "followUps") {
          queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/applications/follow-ups-due"] });
        } else if (feature === "scheduling") {
          queryClient.invalidateQueries({ queryKey: ["/api/scheduled"] });
          queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
        } else if (feature === "replyPolling") {
          queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
        }
      }
    } catch {
      // Silently fail — will retry on next interval
    }
  }, [queryClient]);

  useEffect(() => {
    // Clear all existing timers
    if (followUpTimer.current) clearInterval(followUpTimer.current);
    if (schedulingTimer.current) clearInterval(schedulingTimer.current);
    if (replyPollingTimer.current) clearInterval(replyPollingTimer.current);
    followUpTimer.current = null;
    schedulingTimer.current = null;
    replyPollingTimer.current = null;

    if (!settings) return;

    // Follow-ups
    if (settings.followUpsEnabled) {
      const intervalMs = Math.max(settings.followUpIntervalMinutes, 1) * 60 * 1000;

      // Check if we should run immediately (interval elapsed since last run)
      const lastRun = settings.lastFollowUpAt ? new Date(settings.lastFollowUpAt).getTime() : 0;
      const elapsed = Date.now() - lastRun;
      if (elapsed >= intervalMs) {
        runSync("followUps");
      }

      followUpTimer.current = setInterval(() => runSync("followUps"), intervalMs);
    }

    // Scheduled sending
    if (settings.schedulingEnabled) {
      const intervalMs = Math.max(settings.schedulingIntervalMinutes, 1) * 60 * 1000;

      const lastRun = settings.lastSchedulingAt ? new Date(settings.lastSchedulingAt).getTime() : 0;
      const elapsed = Date.now() - lastRun;
      if (elapsed >= intervalMs) {
        runSync("scheduling");
      }

      schedulingTimer.current = setInterval(() => runSync("scheduling"), intervalMs);
    }

    // Reply polling / inbox monitoring
    if (settings.replyPollingEnabled) {
      const intervalMs = Math.max(settings.replyPollingIntervalMinutes, 1) * 60 * 1000;

      const lastRun = settings.lastReplyPollingAt ? new Date(settings.lastReplyPollingAt).getTime() : 0;
      const elapsed = Date.now() - lastRun;
      if (elapsed >= intervalMs) {
        runSync("replyPolling");
      }

      replyPollingTimer.current = setInterval(() => runSync("replyPolling"), intervalMs);
    }

    return () => {
      if (followUpTimer.current) clearInterval(followUpTimer.current);
      if (schedulingTimer.current) clearInterval(schedulingTimer.current);
      if (replyPollingTimer.current) clearInterval(replyPollingTimer.current);
    };
  }, [
    settings?.followUpsEnabled,
    settings?.followUpIntervalMinutes,
    settings?.lastFollowUpAt,
    settings?.schedulingEnabled,
    settings?.schedulingIntervalMinutes,
    settings?.lastSchedulingAt,
    settings?.replyPollingEnabled,
    settings?.replyPollingIntervalMinutes,
    settings?.lastReplyPollingAt,
    runSync,
  ]);
}
