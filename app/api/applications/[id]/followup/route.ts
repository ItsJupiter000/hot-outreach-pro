import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { z } from "zod";
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
    const schema = z.object({
      templateId: z.string().uuid().nullable(),
      days: z.number().int().min(1).max(30).nullable(),
    });
    const { templateId, days } = schema.parse(body);
    const app = await storage.updateFollowUp(id, templateId, days);
    return NextResponse.json(app);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ message: err.message || "Internal Error" }, { status: 500 });
  }
}
