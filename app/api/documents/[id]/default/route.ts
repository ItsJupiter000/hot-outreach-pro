import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { getAuthUser } from "@/lib/server/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    const doc = await storage.setDefaultDocument(user!.id, id);
    return NextResponse.json(doc);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 404 });
  }
}
