import { NextResponse } from "next/server";
import { scheduledService } from "@/lib/server/scheduledService";
import { getAuthUser } from "@/lib/server/auth";

export async function GET() {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const scheduled = await scheduledService.getAll();
    return NextResponse.json(scheduled);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Internal Error" }, { status: 500 });
  }
}
