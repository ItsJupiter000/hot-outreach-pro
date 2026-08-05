import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const appRecord = await storage.getApplication(id);
    if (appRecord && appRecord.status === "Applied") {
      // Guard against SMTP relay / email preview bots that fetch the pixel
      // immediately after delivery. Only mark "Opened" if the email was sent
      // more than 2 minutes ago — real human opens always happen later.
      const sentAt = new Date(appRecord.sentAt).getTime();
      const twoMinutesMs = 2 * 60 * 1000;
      if (Date.now() - sentAt >= twoMinutesMs) {
        await storage.updateApplication(id, { status: "Opened" });
      }
    }
  } catch (e) {
    console.error("Tracking pixel error:", e);
  }

  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  return new NextResponse(pixel, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": pixel.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
