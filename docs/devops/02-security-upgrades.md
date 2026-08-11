# 02 — Security Upgrades, and How to Read a CVE Report

> **Where we are.** CI gates are live. Before building a container image, we're fixing two HIGH
> advisories that are genuinely exploitable in this app — and, more usefully, learning how to tell
> those apart from the ones that aren't.
>
> **What this stage costs in AWS:** $0.

---

## 1. Why this comes before the Dockerfile

`npm audit` reported 9 advisories. The naive readings are both wrong:

- *"9 vulnerabilities, ship it, audit is always noisy"* — two of these were directly exploitable.
- *"9 vulnerabilities, upgrade everything to latest"* — that would have forced Next 15 → 16, which
  requires React 18 → 19, which is a multi-day migration this project doesn't need.

The useful skill is in between: **reachability analysis.** A CVE only matters if an attacker can
actually reach the vulnerable code path in *your* application.

We do it before the Dockerfile because the alternative is baking a known authentication bypass into
an immutable artifact and then putting it on a public load balancer.

---

## 2. The two that mattered

### `nodemailer` 8.0.4 → 9.0.5 (HIGH)

Advisories included **SMTP command injection via CRLF** in the transport name (EHLO/HELO) and
**arbitrary message header injection via CRLF** in `List-*` header comments.

**Reachable? Yes.** Sending email *is* this application's function, and `lib/server/mailService.ts`
builds messages from user-controlled input — recipient addresses, company names, and template bodies
with `{{variable}}` substitution. Header injection in an outreach tool means an attacker can add
recipients, forge `From`/`Reply-To`, or inject content into mail sent **from your domain** — which
also destroys the sending reputation that the recent deliverability work was building.

**Migration risk: low, and we checked rather than assumed.** The API surface actually in use is tiny
and is the most stable part of nodemailer:

```ts
nodemailer.createTransport({ host, port, secure, auth, xMailer })
transporter.sendMail({ from, to, subject, text, html, replyTo, attachments })
```

Verified: `tsc --noEmit` exit 0, `next build` exit 0, and nodemailer 9.0.5 correctly traced into
`.next/standalone/node_modules`.

`imapflow` 1.2.16 → 1.6.6 came along with it — it was only flagged because it *depends on*
nodemailer.

### `next` 15.5.14 → 15.5.23 (HIGH)

The advisory list included several **"Middleware / Proxy bypass in App Router applications"** entries,
plus cache-poisoning and SSRF.

**Reachable? Yes, and severely.** This app's entire authorization model is `middleware.ts` →
`lib/supabase/middleware.ts`, which calls `auth.getUser()` and redirects unauthenticated requests. And
because all server code uses the Supabase **service-role key** (which bypasses Row Level Security),
there is **no second line of defence** behind the middleware. A middleware bypass here is an
authentication bypass.

**But we did not need Next 16.** This is the interesting part.

---

## 3. The finding that saved a React 19 migration

`npm audit` reported `next` as vulnerable across `9.3.4-canary.0 - 16.3.0-preview.10` and offered:

```json
"fixAvailable": { "name": "next", "version": "16.3.0", "isSemVerMajor": true }
```

Taken at face value: upgrade to Next 16, which requires React 19, which means auditing every one of
the ~26 Radix UI components, `framer-motion`, `recharts`, and `react-hook-form` for React 19
compatibility.

Instead, note that npm publishes a **`backport` dist-tag**:

```
npm view next dist-tags
→ "latest": "16.3.0",  "backport": "15.5.23"
```

That's Vercel's security-patched 15.x line. After upgrading to 15.5.23, re-running the audit gave the
answer:

```
npm audit --json | jq -c '.vulnerabilities.next.via'
→ ["postcss","sharp"]
```

**No advisory objects — only package names.** `via` contains advisory objects for *direct* CVEs and
plain strings for *inherited* ones. So every direct Next.js CVE, including the middleware bypass, is
fixed in 15.5.23. Next is now flagged only because it internally pins `postcss@8.4.31` and depends on
`sharp`.

**The lesson:** `npm audit`'s `range` field is the *union* of all advisory ranges for a package, and
its `fixAvailable` is the version that clears *all* of them — including inherited ones. That makes it
systematically over-recommend major upgrades. Always check `via` to separate "this package is broken"
from "this package depends on something broken".

---

## 4. What's left, and why it's acceptable

Four advisories remain in the production dependency graph. All are **inherited CVEs**, and each was
checked for reachability rather than waved away:

| Package | Path | Reachable? |
|---|---|---|
| `postcss@8.4.31` | pinned inside `next` | **No.** The advisories are XSS via unescaped `</style>` in stringify output, and arbitrary file read via attacker-controlled `sourceMappingURL` in CSS comments. PostCSS runs at **build time**, on our own CSS files, never on user input at runtime. Our *direct* postcss is 8.5.26; only Next's internal pin is old, and we can't override it without `overrides`. |
| `sharp@0.34.5` | via `next` | **No.** `next.config.ts` sets `images: { unoptimized: true }`, so sharp is **never invoked**. The code is present but unreachable. |
| `ws@8.20.0` | `@supabase/supabase-js` → `@supabase/realtime-js` | **No.** Verified by grep: this app uses zero Supabase Realtime — no `.channel()`, no `.subscribe()`. The WebSocket client is shipped but never instantiated. |
| `lodash@4.17.23` | via `recharts` | **No server exposure.** `recharts` is a client-side charting library; this runs in the browser, not in the pod. |

So: **zero production-reachable advisories remain.**

That is a real conclusion, not a comfortable one — and it's stated with the reasoning attached
precisely so it can be re-checked when circumstances change. Two things would invalidate it:

- **Turning on `next/image` optimization** makes `sharp` reachable immediately. If you ever remove
  `images: { unoptimized: true }`, re-run this analysis first.
- **Adopting Supabase Realtime** makes `ws` reachable.

Both are written into `security-backlog.md` as triggers to re-audit.

### Why not force-override the transitive versions?

npm `overrides` could pin `postcss` and `sharp` to patched versions inside Next. Rejected: you'd be
running Next against dependency versions Vercel never tested it with, trading a **provably
unreachable** CVE for an **unknown** compatibility risk. That's a bad trade. The right fix is a Next
release that bumps its own pins.

---

## 5. Empirical verification

Everything below was measured, not assumed.

```
tsc --noEmit --incremental false     → exit 0
eslint . --max-warnings 140          → exit 0  (0 errors, 140 warnings — unchanged)
npm run build                        → exit 0  in 61s
```

Four things the build and smoke test confirmed, each of which shapes the Dockerfile:

**1. Peak build memory: 943 MB RSS.**
```
Maximum resident set size (kbytes): 965664
```
Your EC2 box builds with `--max-old-space-size=1024` and a 2 GB swapfile. 943 MB is *right at the
ceiling*. This retroactively justifies setting `eslint.ignoreDuringBuilds: true` in `next.config.ts`
— adding ESLint's AST analysis into the build would very likely have tipped it into swap or OOM. It
also means the CI runner, not the production host, is where builds belong.

**2. `.env` really is copied into the standalone output.**
```
.next/standalone/.env  (709 bytes)
→ SUPABASE_SERVICE_ROLE_KEY, SMTP_PASS, SMTP_USER, ...
```
Confirmed live. So `.dockerignore` excluding `.env` is a **secret-leak prevention control**, not
hygiene. Without it, `COPY --from=builder /app/.next/standalone ./` bakes the service-role key and
Gmail app password into an image layer — and layers remain extractable even if a later `RUN rm`
deletes the file.

**3. `server.js` defaults to `0.0.0.0`, which is the *opposite* of the danger.**
```js
// .next/standalone/server.js:9
const hostname = process.env.HOSTNAME || '0.0.0.0'
```
The common advice "set `HOSTNAME=0.0.0.0` or Next binds localhost" is outdated for Next 15. The real
hazard is that **Kubernetes injects `HOSTNAME` = the pod name**, so `server.js` binds to the pod name
instead. The fix is the same env var, but it must be set in the **Deployment env** (pod env overrides
image `ENV`), and the reason is inverted.

**4. Probing `/` cannot fail, and SIGTERM does not drain.**
```
GET /login                     → 200
GET /                          → 307  → /login
GET /_next/static/chunks/...   → 200
kill -TERM <pid>               → process exited after 14 ms
```
The 307 is the health-check trap: Kubernetes and ALB target groups both treat **200-399 as success**,
so a probe on `/` reports healthy even if Supabase is down and every route is 500ing. A probe that
cannot fail is worse than no probe — it defeats rolling-update safety by promoting broken pods.

And 14 ms to exit means Next's built-in SIGTERM handler closes the server *immediately*. Since
SIGTERM and load-balancer endpoint removal are **concurrent and unordered**, the LB is still sending
traffic to a socket that has already stopped listening. That is the mechanism behind "flaky ALB 502s
on every deploy", and it's why Stage 2 sets `NEXT_MANUAL_SIG_HANDLE=true` and installs a handler that
flips readiness to 503 *before* it stops listening.

Also visible in the boot log — Blocker #2, live:
```
[instrumentation] Starting background heartbeat (60s interval)
```
Every process that starts runs this. Three replicas, three heartbeats.

---

## 6. Also changed

`@types/nodemailer` moved from `dependencies` to `devDependencies` and bumped `^7 → ^8`. Types are
compile-time only; having them in `dependencies` misrepresents the runtime graph and bloats any
`--omit=dev` install.

Note DefinitelyTyped tops out at `@types/nodemailer@8.0.1` while nodemailer is at 9.0.5 — the types
lag the library. `tsc` passes because the call sites use `as any` casts, but this is worth knowing:
the type coverage on `mailService.ts` is weaker than it appears. It's a good argument for the unit
tests proposed in `01-eslint-and-ci-gates.md`.

---

## Verify this stage

```bash
npm ls next nodemailer imapflow --depth=0    # 15.5.23, 9.0.5, 1.6.6
npm audit --json | jq -c '.vulnerabilities.next.via'   # ["postcss","sharp"] — no CVE objects
npx tsc --noEmit --incremental false          # exit 0
npm run build                                 # exit 0
```

**The one thing to verify manually:** send a real email through the app. `tsc` and `next build` prove
it *compiles* against nodemailer 9; they cannot prove the SMTP conversation still works. Log in, send
one outreach email with a resume attached, and confirm it arrives with the attachment and correct
`From`/`Reply-To`. Then check that reply detection still works, since `imapflow` also moved a minor
version.

**Next:** `03-dockerfile.md` — the immutable artifact, and the four traps confirmed above.
