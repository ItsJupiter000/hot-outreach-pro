import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup";

  const isPublicApi =
    request.nextUrl.pathname.startsWith("/api/track/") ||
    request.nextUrl.pathname.startsWith("/api/cron") ||
    // Kubernetes probes. Also excluded from the matcher in middleware.ts, so in
    // practice we never get here — this is defence against a bad regex edit.
    request.nextUrl.pathname === "/api/healthz" ||
    request.nextUrl.pathname === "/api/readyz" ||
    // BUG FIX: /auth/callback was missing, which broke email confirmation
    // outright. A user clicking a Supabase confirmation link has no session yet,
    // so this middleware 307'd them to /login and the `code` was never exchanged
    // for a session. The whole point of the callback route is to be reached
    // WITHOUT a session.
    request.nextUrl.pathname === "/auth/callback";

  // If no user and trying to access protected route
  if (!user && !isAuthPage && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user exists and on auth page, redirect to dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
