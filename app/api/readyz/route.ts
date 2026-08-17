import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { isDraining, inFlightJobCount } from "@/lib/server/shutdown";

/**
 * READINESS probe. Answers: "should the load balancer send me traffic?"
 *
 * Failure here is non-destructive — the pod is removed from the Service
 * endpoints and the ALB target group, but not restarted. That property is what
 * makes readiness the right place for a drain signal, and the tempting-but-wrong
 * place for a hard dependency check.
 *
 * THE DESIGN DECISION: a hybrid check
 * -----------------------------------
 * Status code depends ONLY on local state (are we draining?). The Supabase
 * dependency check runs too, but it is CACHED and SOFT — reported in the body,
 * never affecting the status code.
 *
 * The case FOR hard-failing on Supabase is real and worth stating: essentially
 * every request in this app touches Supabase. middleware.ts calls auth.getUser()
 * on nearly every path, and every app/api/** handler calls getAuthUser() then
 * storage.*. A pod that cannot reach Supabase can serve nothing useful, so
 * leaving it in the target group just means serving 500s.
 *
 * Four reasons it loses anyway:
 *
 *  1. CORRELATED FAILURE. Supabase is a single shared external dependency. If it
 *     blips, all N replicas fail readiness in the same instant, the ALB has ZERO
 *     healthy targets, and clients get raw load-balancer 503s instead of the
 *     app's error page. You also lose /login and static assets, which would
 *     otherwise still work fine.
 *  2. ROLLOUTS WEDGE. With maxUnavailable/minReadySeconds, a deploy during a
 *     Supabase blip never completes; with progressDeadlineSeconds it auto-fails.
 *     Now you are debugging two incidents instead of one.
 *  3. PROBE AMPLIFICATION. Readiness fires every ~5-10s per pod. Three replicas
 *     is ~18-36 extra Supabase calls per minute, forever, purely to probe — real
 *     rate-limit budget spent learning something monitoring should tell you.
 *  4. WRONG SUBJECT. Readiness describes THIS POD's fitness. Supabase
 *     reachability is a property of the world, not of pod 3.
 *
 * The hybrid keeps the diagnostic signal with none of the self-harm, and bounds
 * the extra load at 2 checks/minute/pod regardless of probe frequency.
 *
 * `?deep=1` bypasses the cache AND makes the check authoritative (503 on
 * failure). That variant is for synthetic monitors, CI smoke tests, and
 * on-call runbooks — never for the kubelet.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DependencyResult = {
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
  error?: string;
};

// Module-scope cache. Safe per-replica: each pod caches its own view, which is
// correct, because readiness is a per-pod question.
let cached: DependencyResult | null = null;

async function checkSupabase(): Promise<DependencyResult> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    // Imported lazily so that a Supabase misconfiguration cannot crash this
    // module at import time — lib/server/supabaseClient.ts throws on module load
    // when its env vars are missing, and we want to REPORT that, not die of it.
    const { supabase } = await import("@/lib/server/supabaseClient");

    // A HEAD-style count is the cheapest possible authenticated round trip: it
    // transfers no rows. Deliberately NOT auth.getUser() — that needs a token
    // and exercises a different subsystem than the data path we actually depend
    // on.
    const query = supabase
      .from("settings")
      .select("*", { count: "exact", head: true })
      .limit(1);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`timeout after ${env.READINESS_CHECK_TIMEOUT_MS}ms`)),
        env.READINESS_CHECK_TIMEOUT_MS
      )
    );

    const { error } = await Promise.race([query, timeout]);
    if (error) throw new Error(error.message);

    return { ok: true, latencyMs: Date.now() - started, checkedAt };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      checkedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function getDependencyResult(bypassCache: boolean): Promise<DependencyResult> {
  if (!bypassCache && cached) {
    const age = Date.now() - new Date(cached.checkedAt).getTime();
    if (age < env.READINESS_CACHE_TTL_MS) return cached;
  }
  cached = await checkSupabase();
  return cached;
}

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const draining = isDraining();

  // Short-circuit while draining: we are about to stop listening, so there is no
  // point spending a Supabase round trip to confirm we are leaving.
  if (draining) {
    return NextResponse.json(
      { status: "draining", draining: true, inFlightJobs: inFlightJobCount() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabaseResult = await getDependencyResult(deep);

  // Only ?deep=1 lets a dependency failure change the status code.
  const status = deep && !supabaseResult.ok ? 503 : 200;

  return NextResponse.json(
    {
      status: status === 200 ? "ready" : "degraded",
      draining: false,
      inFlightJobs: inFlightJobCount(),
      checks: { supabase: supabaseResult },
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}
