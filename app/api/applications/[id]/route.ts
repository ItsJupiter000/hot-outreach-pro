import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { z } from "zod";
import { api } from "@shared/routes";
import { getAuthUser } from "@/lib/server/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = api.applications.update.input.parse(body);
    const appRecord = await storage.updateApplication(id, input);
    return NextResponse.json(appRecord);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 }
      );
    }
    if (err.message === "Application not found") {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { id } = await params;
    await storage.deleteApplication(id);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
