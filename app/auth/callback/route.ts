import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCanonicalOrigin, safeRelativePath } from "@/lib/server/appUrl";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase auth callback — exchanges the one-time `code` for a session cookie.
 *
 * Reached WITHOUT a session by design (that is the whole point), which is why
 * this path is now in the isPublicApi allowlist in lib/supabase/middleware.ts.
 * It was missing there, so email confirmation was broken: the middleware 307'd
 * unauthenticated visitors to /login and the code was never exchanged.
 *
 * Origin is derived via getCanonicalOrigin() rather than `new URL(request.url)`
 * because behind a TLS-terminating ALB the latter yields http://, which drops
 * Secure cookies on the redirect. See lib/server/appUrl.ts for the full
 * reasoning.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRelativePath(searchParams.get("next"));
  const origin = getCanonicalOrigin(request);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Surface the reason in logs — a failed exchange is almost always an expired
    // or already-used code, and silently bouncing to /login makes that
    // indistinguishable from "wrong password".
    console.error("[auth/callback] code exchange failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login`);
}
