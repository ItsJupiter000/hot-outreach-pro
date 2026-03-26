import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/server/storage";
import { getAuthUser } from "@/lib/server/auth";

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    let applications = await storage.getApplications(user!.id);
    const search = request.nextUrl.searchParams.get("search");
    const status = request.nextUrl.searchParams.get("status");

    if (search) {
      const s = search.toLowerCase();
      applications = applications.filter(
        (a) =>
          a.companyName.toLowerCase().includes(s) ||
          a.email.toLowerCase().includes(s)
      );
    }

    if (status) {
      applications = applications.filter((a) => a.status === status);
    }

    return NextResponse.json(applications);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
