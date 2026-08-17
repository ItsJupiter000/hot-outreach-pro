import { NextResponse } from "next/server";

/**
 * LIVENESS probe. Answers exactly one question:
 *   "Is a restart the only thing that can fix this process?"
 *
 * It therefore checks NOTHING but its own ability to respond — no Supabase, no
 * SMTP, no disk. If this handler runs, the event loop is alive and the HTTP
 * server is accepting connections, which is the entire claim being made.
 *
 * WHY NO DEPENDENCY CHECKS HERE
 * -----------------------------
 * A failed liveness probe makes the kubelet KILL the container. If liveness
 * depended on Supabase, a 30-second Supabase blip would restart every replica
 * simultaneously — turning a partial degradation into a total outage, plus a
 * CrashLoopBackOff that outlives the original incident. Dependency checks belong
 * in readiness (see ./readyz), where failure is non-destructive: the pod is
 * merely removed from the load balancer.
 *
 * Note this deliberately stays 200 even while draining. Liveness must not fail
 * during a graceful shutdown, or the kubelet would SIGKILL the pod mid-drain and
 * defeat the whole purpose. Only readiness flips to 503.
 *
 * WHY NOT JUST PROBE `/`
 * ----------------------
 * Because `/` CANNOT FAIL. It lives in app/(dashboard)/, so an unauthenticated
 * probe gets a 307 redirect to /login from lib/supabase/middleware.ts:41-45 —
 * and Kubernetes httpGet probes treat any status in 200-399 as SUCCESS.
 * Measured: `curl -o /dev/null -w '%{http_code}' /` returns 307.
 *
 * So a probe on `/` would keep reporting healthy even with Supabase down and
 * every route 500ing. A probe that cannot fail is strictly worse than no probe:
 * it creates false confidence and it defeats rolling-update safety, because
 * broken pods get promoted. It also costs a Supabase auth round trip plus a full
 * RSC render of the dashboard on every check.
 */

// Both are required, and neither is boilerplate.
//
// A GET route handler that touches no dynamic API is STATICALLY PRERENDERED at
// build time in the App Router — Next would execute this during `docker build`
// and freeze the response into the image. A frozen liveness probe is a probe
// that can never fail, which is the exact bug described above.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { status: "ok", uptimeSeconds: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
