import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { getAuthUser } from "@/lib/server/auth";

export async function GET() {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const settings = await storage.getSettings(user!.id);
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const updates = await request.json();
    const settings = await storage.updateSettings(user!.id, updates);
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
