import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { getAuthUser } from "@/lib/server/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    await storage.deleteDocument(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
