import { NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { getAuthUser } from "@/lib/server/auth";

export async function GET() {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const apps = await storage.getApplicationsDueForFollowUp(user!.id);
    return NextResponse.json(apps);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
