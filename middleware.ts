import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // api/healthz and api/readyz are excluded HERE, not just in the isPublicApi
    // allowlist, and the difference matters for cost.
    //
    // If they were only allowlisted, this middleware would still RUN on every
    // probe — and lib/supabase/middleware.ts:30 performs a network auth.getUser()
    // call to Supabase on every invocation. That is N pods x 2 probes x ~6/min,
    // forever, purely to answer "am I alive". Excluding them from the matcher
    // means the probe never reaches Supabase at all.
    //
    // They are ALSO in isPublicApi as belt-and-braces, because this regex is
    // easy to get subtly wrong when editing.
    "/((?!api/healthz|api/readyz|_next/static|_next/image|favicon.ico|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
