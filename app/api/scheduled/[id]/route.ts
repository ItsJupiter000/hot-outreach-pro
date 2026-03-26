import { NextRequest, NextResponse } from "next/server";
import { scheduledService } from "@/lib/server/scheduledService";
import { getAuthUser } from "@/lib/server/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    await scheduledService.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Internal Error" }, { status: 500 });
  }
}
