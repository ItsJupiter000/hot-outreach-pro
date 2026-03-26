import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { z } from "zod";
import { api } from "@shared/routes";
import { getAuthUser } from "@/lib/server/auth";

export async function GET() {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const templates = await storage.getTemplates(user!.id);
    return NextResponse.json(templates);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const body = await request.json();
    const input = api.templates.create.input.parse(body);
    const template = await storage.createTemplate(user!.id, input);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.errors[0].message, field: err.errors[0].path.join(".") },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}
