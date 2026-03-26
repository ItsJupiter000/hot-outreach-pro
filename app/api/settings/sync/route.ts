import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { processFollowUps } from "@/lib/server/followUpService";
import { pollInboxForUser } from "@/lib/server/imapService";
import { runScheduledSends } from "@/lib/server/scheduledService";
import { getAuthUser } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { feature } = await request.json();

    if (feature === "scheduling") {
      const protocol = request.headers.get("x-forwarded-proto") || "https";
      const host = request.headers.get("host") || "localhost";
      await runScheduledSends(protocol, host);
      await storage.updateSettings(user!.id, { lastSchedulingAt: new Date().toISOString() });
    } else if (feature === "followUps") {
      await processFollowUps(user!.id);
      await storage.updateSettings(user!.id, { lastFollowUpAt: new Date().toISOString() });
    } else if (feature === "replyPolling") {
      await pollInboxForUser(user!.id);
      await storage.updateSettings(user!.id, { lastReplyPollingAt: new Date().toISOString() });
    } else {
      return NextResponse.json({ message: "Invalid feature" }, { status: 400 });
    }

    return NextResponse.json({ message: `${feature} sync completed` });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
