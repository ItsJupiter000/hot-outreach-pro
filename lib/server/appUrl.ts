import { env } from "./env";

/**
 * Determine the canonical external origin for building absolute redirect URLs.
 *
 * WHY THIS IS NOT `new URL(request.url).origin`
 * ---------------------------------------------
 * Behind a TLS-terminating load balancer, the ALB accepts HTTPS from the client
 * and forwards plain HTTP to the pod. So `request.url` inside the pod reads
 * `http://...`, and deriving the origin from it produces an `http://` redirect.
 *
 * Two concrete consequences:
 *  1. The browser is redirected from HTTPS to HTTP. Any cookie set with the
 *     `Secure` attribute on that response is silently DROPPED, so the session
 *     the user just authenticated for does not persist.
 *  2. It downgrades the connection, which HSTS will either break loudly or
 *     silently upgrade depending on the browser — neither is a behaviour you
 *     want to depend on.
 *
 * It is also a Host-header-injection vector: `request.url`'s host comes from the
 * client-supplied Host header, so an attacker can control where your redirect
 * points.
 *
 * PRECEDENCE (most trustworthy first)
 *  1. NEXT_PUBLIC_APP_URL — configured by us, not derived from the request.
 *  2. x-forwarded-proto + x-forwarded-host — set by the ALB. Trustworthy only
 *     because the ALB overwrites rather than appends, and nothing else can reach
 *     the pod. This is the standard behind-a-proxy pattern.
 *  3. The request origin — correct for local development, where there is no
 *     proxy and the Host header is genuinely ours.
 */
export function getCanonicalOrigin(request: Request): string {
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (forwardedProto && forwardedHost) {
    // A comma-separated list means the request crossed multiple proxies; the
    // first entry is the value the original client saw.
    const proto = forwardedProto.split(",")[0].trim();
    const host = forwardedHost.split(",")[0].trim();
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/**
 * Sanitize a caller-supplied `next` parameter before using it in a redirect.
 *
 * Returns a path that is guaranteed to stay on this origin, defaulting to "/".
 *
 * The rejected cases, and why each matters:
 *  - `//evil.com` — a PROTOCOL-RELATIVE URL. Browsers resolve `Location: //host`
 *    against the current scheme, so this is a genuine open redirect even though
 *    it looks like a path. This is the case people miss.
 *  - `https://evil.com` — an absolute URL.
 *  - `\\evil.com` or `/\evil.com` — some browsers historically normalized
 *    backslashes to forward slashes, making these equivalent to the above.
 *  - anything not starting with `/` — would resolve relative to the current
 *    directory, which is unpredictable.
 *
 * An open redirect on an auth callback is worth more than it looks: it lets an
 * attacker send a victim a link to YOUR trusted domain that lands them on a
 * lookalike login page, immediately after a successful real authentication.
 */
export function safeRelativePath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.includes("\\")) return "/";
  return next;
}
