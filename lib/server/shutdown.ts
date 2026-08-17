import { env } from "./env";

/**
 * Graceful shutdown coordination.
 *
 * THE PROBLEM
 * -----------
 * Next 15 installs its own SIGTERM handler (node_modules/next/dist/server/lib/
 * start-server.js) which closes the HTTP server and exits **immediately**.
 * Measured on this app: `kill -TERM <pid>` exits in **14 ms**.
 *
 * That is wrong in Kubernetes, because SIGTERM and endpoint removal are
 * CONCURRENT AND UNORDERED events. The kubelet sends SIGTERM at the same moment
 * the endpoints controller begins removing the pod, which then has to propagate
 * to kube-proxy and — for an ALB with IP targets — through target-group
 * deregistration. For a second or more after SIGTERM, the load balancer is
 * still routing requests to you, and your server has already stopped listening.
 *
 * The result is connection-refused / 502s on EVERY rolling deploy, invariably
 * blamed on "the ALB being flaky".
 *
 * THE FIX
 * -------
 * Flipping readiness to 503 BEFORE closing the listener is the only way to
 * actively tell the load balancer to stop sending traffic. That converts an
 * unordered race into a deterministic handoff. Steps 1 and 2 below are what
 * eliminate deploy-time 502s; everything else is about not losing work.
 *
 * ⚠️  REQUIRES `NEXT_MANUAL_SIG_HANDLE=true`
 * Without that env var, Next's handler ALSO runs and exits in ~14 ms, so the
 * drain never happens. The Dockerfile sets it. If you want the drain on the
 * legacy EC2/PM2 box too, add it to .env there. installShutdownHandlers() logs
 * a warning when it detects the mismatch, because a silently-ignored drain is
 * the worst outcome: you believe you have graceful shutdown and you do not.
 */

/**
 * ⚠️ STATE LIVES ON `globalThis`, NOT IN MODULE SCOPE. This is load-bearing.
 *
 * Next.js compiles route handlers and instrumentation.ts into SEPARATE webpack
 * bundles, each with its own module registry. A plain `let draining = false` at
 * module scope therefore produces a DIFFERENT variable per bundle:
 * instrumentation.ts (which dynamically imports this file) sets the flag on its
 * copy, and app/api/readyz/route.ts (which statically imports it) reads another.
 *
 * This was not theoretical — it was caught by testing. Before this fix:
 *   kill -TERM <pid>
 *   → [shutdown] SIGTERM received — draining for 3000ms   (handler ran)
 *   → GET /api/readyz  ⇒  200 {"draining":false}          (WRONG)
 *
 * The pod would have kept reporting Ready for its entire drain window, so the
 * load balancer would never have removed it — silently reintroducing the exact
 * deploy-time 502s this module exists to prevent, while the logs claimed
 * everything was fine.
 *
 * `Symbol.for()` uses V8's cross-realm global symbol registry, so every bundle
 * in the process resolves to the same key. This is the same reason the ecosystem
 * writes `globalThis.prisma` rather than a module-level client.
 */
type ShutdownState = {
  draining: boolean;
  handlersInstalled: boolean;
  inFlight: Set<Promise<unknown>>;
  beforeExitHooks: Array<() => void | Promise<void>>;
  abortController: AbortController;
};

const STATE_KEY = Symbol.for("hot-outreach.server.shutdown");

function getState(): ShutdownState {
  const g = globalThis as typeof globalThis & { [STATE_KEY]?: ShutdownState };
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = {
      draining: false,
      handlersInstalled: false,
      inFlight: new Set(),
      beforeExitHooks: [],
      abortController: new AbortController(),
    };
  }
  return g[STATE_KEY];
}

export function isDraining(): boolean {
  return getState().draining;
}

/** Signals background work to stop CLAIMING new items. In-flight work finishes. */
export function shutdownSignal(): AbortSignal {
  return getState().abortController.signal;
}

export function inFlightJobCount(): number {
  return getState().inFlight.size;
}

/** Marked separately from the handler so tests (and /api/readyz) can observe it. */
export function markDraining(): void {
  const s = getState();
  s.draining = true;
  s.abortController.abort();
}

/**
 * Register cleanup to run once the drain delay has elapsed — clearing intervals,
 * closing IMAP connections, and so on.
 */
export function onBeforeExit(hook: () => void | Promise<void>): void {
  getState().beforeExitHooks.push(hook);
}

/**
 * Track a background job so shutdown waits for it.
 *
 * Needed because the Stage 6 design runs the cron sweep INSIDE a web pod (the
 * Kubernetes CronJob is only the trigger). So a rolling deploy can land on the
 * pod that is 200 ms into an SMTP handshake. Also worth applying to
 * POST /api/send-email, which performs a full synchronous SMTP conversation and
 * deletes the application row it just created if the send fails — killing that
 * mid-flight is precisely the partial-state problem.
 */
export function trackJob<T>(promise: Promise<T>): Promise<T> {
  const s = getState();
  s.inFlight.add(promise);
  // `void` the catch: we only care about settlement for tracking purposes.
  // The caller still owns the rejection.
  promise.catch(() => {}).finally(() => s.inFlight.delete(promise));
  return promise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJobs(timeoutMs: number): Promise<boolean> {
  const s = getState();
  const deadline = Date.now() + timeoutMs;
  while (s.inFlight.size > 0 && Date.now() < deadline) {
    await Promise.race([
      Promise.allSettled([...s.inFlight]),
      sleep(Math.min(250, Math.max(0, deadline - Date.now()))),
    ]);
  }
  return s.inFlight.size === 0;
}

async function shutdown(signal: string): Promise<void> {
  const s = getState();

  // Idempotent: Kubernetes can send SIGTERM more than once, and a second
  // invocation must not restart the drain clock or double-run the hooks.
  if (s.draining) {
    console.log(`[shutdown] ${signal} received while already draining — ignoring`);
    return;
  }

  console.log(`[shutdown] ${signal} received — draining for ${env.SHUTDOWN_DRAIN_MS}ms`);

  // 1. Fail readiness FIRST. This is the highest-value line in the file.
  markDraining();

  // 2. Keep serving traffic while the load balancer notices we are unhealthy.
  await sleep(env.SHUTDOWN_DRAIN_MS);

  // 3. Stop recurring work (intervals, pollers).
  for (const hook of s.beforeExitHooks) {
    try {
      await hook();
    } catch (err) {
      console.error("[shutdown] beforeExit hook failed:", err);
    }
  }

  // 4. Let in-flight sends finish, but bounded — terminationGracePeriodSeconds
  //    is a hard ceiling, and being SIGKILLed mid-write is worse than
  //    abandoning one job cleanly.
  const jobsDone = await waitForJobs(env.SHUTDOWN_JOB_TIMEOUT_MS);
  if (!jobsDone) {
    console.warn(
      `[shutdown] ${s.inFlight.size} job(s) still running after ` +
        `${env.SHUTDOWN_JOB_TIMEOUT_MS}ms — exiting anyway`
    );
  }

  console.log("[shutdown] complete — exiting 0");
  process.exit(0);
}

export function installShutdownHandlers(): void {
  const s = getState();
  if (s.handlersInstalled) return;
  s.handlersInstalled = true;

  // Reading Next's own runtime flag. Deliberately not in env.ts: putting it
  // there would imply we own the value, and we do not — Next.js reads it too.
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_MANUAL_SIG_HANDLE !== "true") {
    console.warn(
      "[shutdown] NEXT_MANUAL_SIG_HANDLE is not 'true' — Next.js will also " +
        "handle SIGTERM and exit immediately, so the drain delay will NOT " +
        "take effect. Set NEXT_MANUAL_SIG_HANDLE=true to enable graceful shutdown."
    );
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(
    `[shutdown] handlers installed (drain=${env.SHUTDOWN_DRAIN_MS}ms, ` +
      `jobTimeout=${env.SHUTDOWN_JOB_TIMEOUT_MS}ms)`
  );
}
