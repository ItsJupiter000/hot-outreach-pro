import { NextRequest, NextResponse } from "next/server";
import { scheduledService } from "@/lib/server/scheduledService";
import { executeEmailSend } from "@/app/api/send-email/route";
import { getAuthUser } from "@/lib/server/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    const all = await scheduledService.getAll();
    const email = all.find((e) => e.id === id);
    if (!email) {
      return NextResponse.json({ message: "Scheduled email not found" }, { status: 404 });
    }

    await executeEmailSend(email, email.protocol || "http", email.host || "localhost", user!.id);
    await scheduledService.remove(id);
    return NextResponse.json({ message: "Sent successfully" });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Internal Error" }, { status: 500 });
  }
}
