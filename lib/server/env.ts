import { z } from "zod";

/**
 * Validated server configuration.
 *
 * WHY THIS EXISTS
 * ---------------
 * There are ~26 raw `process.env` reads scattered across 7 files. Two of them
 * are actively dangerous:
 *
 *   - CRON_SECRET is read at app/api/cron/route.ts:10 and defined in no .env
 *     file, and the guard is written `if (secret && ...)` — so an unset value
 *     disables authentication entirely on a publicly reachable endpoint.
 *   - MY_NAME / MY_EMAIL are read by lib/server/mailService.ts and appear in no
 *     .env file at all.
 *
 * Scattered reads make startup validation impossible: you cannot fail fast on
 * bad configuration if you do not know what configuration exists. Centralizing
 * them means a missing required variable crashes the pod at BOOT, with a clear
 * message you can read in `kubectl logs`, rather than throwing a 500 at 3am on
 * the first cron tick.
 *
 * SCOPE — read this before adding to it
 * -------------------------------------
 * This module deliberately only covers variables introduced from Stage 2
 * onward. The existing readers (supabaseClient.ts, mailService.ts,
 * imapService.ts, the supabase middleware) are NOT migrated yet, and nothing
 * here is `required`.
 *
 * That restraint is intentional. Marking CRON_SECRET as required today would
 * crash the running EC2 instance on the next `./redeploy.sh`, because it is not
 * set there. Each variable graduates to "required" in the phase that actually
 * provides it — CRON_SECRET in Stage 6, when the Kubernetes CronJob and the
 * Secrets Manager entry land together.
 *
 * SERVER ONLY. Do not import this from a client component — zod validation and
 * non-public env vars must never reach the browser bundle.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Canonical external origin, e.g. https://outreach.example.com
   *
   * Required behind a TLS-terminating load balancer. An ALB forwards HTTP
   * internally, so deriving the origin from the incoming request yields
   * "http://" — which downgrades redirect schemes and causes browsers to drop
   * any `Secure` cookie set on that response. See lib/server/appUrl.ts.
   */
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  /**
   * How long to keep serving traffic after SIGTERM before closing the listener.
   *
   * Must exceed (readinessProbe.periodSeconds × failureThreshold) PLUS the load
   * balancer's deregistration delay. With periodSeconds:5 / failureThreshold:2
   * and a 10s ALB deregistration delay, 15s is the right order of magnitude.
   *
   * terminationGracePeriodSeconds must be comfortably larger than this plus
   * SHUTDOWN_JOB_TIMEOUT_MS, or the kubelet SIGKILLs us mid-drain.
   */
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).max(120_000).default(15_000),

  /** Max time to wait for in-flight background jobs (email sends) to finish. */
  SHUTDOWN_JOB_TIMEOUT_MS: z.coerce.number().int().min(0).max(120_000).default(20_000),

  /**
   * How long a Supabase reachability result is cached for /api/readyz.
   *
   * This bound is the whole reason the readiness check is safe: probes fire
   * every ~5-10s per pod, but the dependency check runs at most twice a minute
   * per pod regardless. Without it, N replicas × 6 probes/min is a permanent
   * tax on the Supabase auth/REST rate limit, paid forever, to learn something
   * your monitoring should be telling you.
   */
  READINESS_CACHE_TTL_MS: z.coerce.number().int().min(0).default(30_000),

  /** Timeout for the readiness dependency check itself. Must be short. */
  READINESS_CHECK_TIMEOUT_MS: z.coerce.number().int().min(100).default(2_000),

  /**
   * Whether instrumentation.ts runs the 60s in-process background heartbeat.
   *
   * Defaults to TRUE so the existing EC2/PM2 deployment keeps working unchanged
   * — today it is the only thing driving scheduled sends, follow-ups, and IMAP
   * reply polling.
   *
   * Set to "false" in Kubernetes. The heartbeat runs in EVERY server process
   * with no distributed lock, coordinated only by advisory settings.last*At
   * timestamps that are read-then-written (a check-then-act race). Three
   * replicas therefore send every email up to three times. Stage 6 replaces it
   * with a Kubernetes CronJob calling /api/cron, where concurrencyPolicy:Forbid
   * provides singleton semantics from the orchestrator rather than from
   * hopeful application code.
   *
   * Introducing the flag now means that cutover is a values.yaml change, not a
   * code change — and it lets the very first EKS deploy be safe by default.
   */
  ENABLE_INPROCESS_SCHEDULER: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof schema>;

function load(): ServerEnv {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    // Print every problem at once, not just the first. A pod that crash-loops
    // should tell you everything wrong in one log line, so you fix it in one
    // deploy instead of three.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env: ServerEnv = load();
