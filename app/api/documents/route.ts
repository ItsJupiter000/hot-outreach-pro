import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { supabase } from "@/lib/server/supabaseClient";
import { getAuthUser } from "@/lib/server/auth";

export async function GET() {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const docs = await storage.getDocuments(user!.id);
    return NextResponse.json(docs);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    const type = (formData.get("type") as string) || "Resume";
    const name = (formData.get("name") as string) || file.name;
    const fileName = file.name;
    const storagePath = `${user!.id}/${Date.now()}-${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json(
        { message: "File upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
    const filePath = urlData.publicUrl;

    const doc = await storage.createDocument(user!.id, {
      name,
      type: type as any,
      filePath,
      fileName,
      isDefault: formData.get("isDefault") === "true",
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    console.error("Document upload error:", err);
    return NextResponse.json({ message: err.message || "Internal Error" }, { status: 500 });
  }
}
