import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { getAuthUser } from "@/lib/server/auth";

export async function GET() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  try {
    const profile = await storage.getProfile(user!.id);
    if (!profile) {
      return NextResponse.json({ message: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  try {
    const updates = await request.json();
    const profile = await storage.updateProfile(user!.id, updates);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
