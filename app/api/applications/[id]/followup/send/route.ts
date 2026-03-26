import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { sendSingleFollowUp } from "@/lib/server/followUpService";
import { getAuthUser } from "@/lib/server/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    const app = await storage.getApplication(id);
    if (!app) {
      return NextResponse.json({ message: "Application not found" }, { status: 404 });
    }
    await sendSingleFollowUp(app, user!.id);
    return NextResponse.json({ message: "Follow-up sent successfully" });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
