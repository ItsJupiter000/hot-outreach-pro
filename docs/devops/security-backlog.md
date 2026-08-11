# Security Backlog

Findings from the migration analysis that are **not** fixed by infrastructure work, tracked here so
they aren't quietly forgotten. Ordered by severity.

Status key: 🔴 open · 🟡 scheduled · ✅ fixed

---

## 🔴 P1 — Cross-tenant access to scheduled emails

Three separate endpoints have no ownership check. Any authenticated user can act on any other user's
data.

| Endpoint | Bug |
|---|---|
| `app/api/scheduled/route.ts:10` | `scheduledService.getAll()` returns **every user's** scheduled emails — recipient addresses, company names, custom message bodies. `user` is destructured and then never used to filter. |
| `app/api/scheduled/[id]/route.ts:14` | `DELETE` by id with no ownership check — any user can cancel any other user's scheduled email. |
| `app/api/scheduled/[id]/send/route.ts:21` | Sends another user's scheduled email, and does it **under the caller's identity and SMTP credentials** (passes `user!.id` rather than `email.userId`). |

**Root cause:** all server code uses the Supabase **service-role** client
(`lib/server/supabaseClient.ts:11`), which bypasses Row Level Security entirely. So the RLS policies
in `supabase_auth_migration.sql` protect nothing on this path — authorization is enforced only by
application code, and here it simply isn't. These are missing `WHERE` clauses, not RLS
misconfigurations.

🟡 **Scheduled: Stage 6.** Fixed as part of the `scheduled_emails` table migration, which rewrites
these exact lines anyway.

---

## 🔴 P1 — `/api/cron` is unauthenticated

`app/api/cron/route.ts:12`:

```ts
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
```

`CRON_SECRET` is **not set** in `.env` and was not in `.env.example`, so `cronSecret` is `undefined`,
the condition short-circuits to `false`, and the endpoint is **fully open**. It is also explicitly in
the middleware public allowlist (`lib/supabase/middleware.ts:38`), so there is no second gate.

Anyone can trigger email sends for every user in the system, at any rate, from a curl loop.

**Three changes needed:**
1. Fail **closed** — return 503 if the secret is absent, never 200. (Distinguish 503 "misconfigured
   server" from 401 "bad credential" so alerting can tell them apart.)
2. Require it at startup via zod in `lib/server/env.ts`, so a missing secret means the pod never
   becomes ready rather than silently serving an open endpoint.
3. Constant-time comparison — `!==` on strings short-circuits and leaks the secret's prefix through
   timing. Hash both sides with SHA-256 (equal length, so `timingSafeEqual` won't throw) and compare.

🟡 **Scheduled: Stage 6.** `CRON_SECRET` becomes mandatory for the Kubernetes CronJob regardless.

---

## 🔴 P1 — `app/api/settings/sync` is a second uncontrolled cron trigger

`app/api/settings/sync/route.ts:18` calls `runScheduledSends(...)` — the **global** queue drain — for
any authenticated user. So user A's browser tab sends user B's scheduled emails, and any logged-in
user can hammer it with no rate limit.

Triggered from the browser by `hooks/use-heartbeat.ts`, wired in
`components/layout/DashboardShell.tsx:20`.

🟡 **Scheduled: Stage 6.** The `scheduling` branch is removed once the CronJob exists.

---

## 🔴 P2 — `profiles.smtp_pass` stored in plaintext and returned by the API

`supabase_auth_migration.sql:22` defines `smtp_pass` as a plain `text` column. It is read at
`lib/server/storage.ts:111` and **returned verbatim by `GET /api/profile`**.

Consequences: anyone with database read access (or a leaked service-role key, or the `GET /api/profile`
response in a browser devtools/log/proxy) obtains users' Gmail app passwords. Those grant full
mailbox access, not just send capability.

**Fix direction:** envelope-encrypt with AWS KMS — store ciphertext, decrypt only at send time, and
never include the field in any API response (return a boolean `smtpConfigured` instead). A
partial mitigation available immediately at near-zero cost: **stop returning the field from
`GET /api/profile`.**

🔴 **Open — deferred by explicit decision.** The read-path removal is worth doing sooner than the
full KMS work.

---

## 🔴 P2 — IDOR on follow-up send

`app/api/applications/[id]/followup/send/route.ts:15-19` calls `getApplication(id)` with no ownership
check — any authenticated user can trigger a follow-up on any application.

🟡 **Scheduled: Stage 6**, alongside the other ownership fixes.

---

## 🔴 P2 — `/api/track/open/[id]` is a dead, unauthenticated write endpoint

Publicly reachable (allowlisted at `lib/supabase/middleware.ts:37`), unauthenticated, unrate-limited,
and it **mutates** `applications.status` to `"Opened"` for any id supplied.

And it is **dead**: tracking pixels were deliberately removed from outbound mail for deliverability
(see the comment at `app/api/send-email/route.ts:99-100`), so nothing generates these URLs anymore.

An anonymous user can enumerate UUIDs and corrupt other people's application state.

**Fix: delete the route and its allowlist entry.** Zero functional loss.

🟡 **Scheduled: Stage 6.**

---

## 🔴 P3 — No file upload validation

`app/api/documents/route.ts:23-42` accepts any file, of any size and any type, with no checks.

Two distinct problems:
- **Memory DoS.** `request.formData()` buffers the entire body **before** any size check can run, so a
  single large POST OOM-kills the pod. On a 384 Mi pod that's trivial. (`bodySizeLimit` in
  `next.config.ts` applies to Server Actions, **not** Route Handlers, so it does not help.) Needs an
  early `Content-Length` rejection plus an ingress body-size limit.
- **Client-controlled object key.** The key is `${user.id}/${Date.now()}-${fileName}` using the raw
  client filename. `Date.now()` collides under concurrency, and a name containing `/` or `..`
  reshapes the key prefix — and that `user.id` prefix is the only structural tenancy marker. Use a
  server-generated UUID and keep the original name in the `file_name` column.

🟡 **Scheduled: Stage 6**, with the S3 migration.

---

## 🔴 P3 — Resume documents are in a public bucket

`supabase_schema.sql:105-107` creates the `documents` bucket with `public => true`, and
`app/api/documents/route.ts:52-53` persists the **public URL** into `documents.file_path`.

Resumes are PII — full name, phone, location, employment history, sometimes home address. Every one is
retrievable by anyone with the URL, forever, with no authentication, no revocation, and no access log.
A public URL cannot be un-published once it reaches a log aggregator, a Slack paste, or a proxy cache.

🟡 **Scheduled: Stage 6.** Private S3 bucket + short-lived presigned URLs, which bounds the blast
radius of the same leak to 5 minutes and makes every download an auditable event.

---

## 🔴 P3 — `scheduledFor` accepts arbitrary strings

`shared/schema.ts` types it as `z.string().optional()` with no datetime validation. So
`scheduledFor: "banana"` → `new Date("banana").getTime()` → `NaN`, and `NaN > Date.now()` is `false`
— meaning the email **sends immediately** instead of erroring.

**Fix:** `z.string().datetime()`.

🟡 **Scheduled: Stage 6.**

---

## 🔴 P3 — `/auth/callback` is broken and downgrades scheme

Two bugs in one route:

1. **Not in the middleware public allowlist** (`lib/supabase/middleware.ts:36-38` covers only
   `/api/track/` and `/api/cron`). An unauthenticated user clicking an email-confirmation link has no
   session, so middleware 307s them to `/login` and the code is never exchanged. **Email confirmation
   is broken today.**
2. `app/auth/callback/route.ts:5` derives `origin` from `new URL(request.url)`. Behind a
   TLS-terminating ALB that yields `http://`, so the post-confirmation redirect **downgrades the
   scheme** and any `Secure` cookie set on that response is dropped. It's also a Host-header-injection
   vector on the redirect target.

**Fix:** allowlist the path, and derive the origin from the configured `NEXT_PUBLIC_APP_URL` (falling
back to `x-forwarded-proto` + `x-forwarded-host`).

🟡 **Scheduled: Stage 2**, with the health endpoints — same file, same middleware edit.

---

## Re-audit triggers

Four dependency advisories were assessed as **unreachable** in `02-security-upgrades.md`. Each
conclusion depends on a current fact. If any of these changes, **re-run the analysis**:

| Trigger | Makes this reachable |
|---|---|
| Removing `images: { unoptimized: true }` from `next.config.ts` | `sharp` libvips CVEs — currently never invoked |
| Adopting Supabase Realtime (`.channel()` / `.subscribe()`) | `ws` CVE — currently never instantiated |
| Running PostCSS over untrusted CSS, or enabling CSS source maps in production | `postcss` sourceMappingURL file-read CVE — currently build-time only, on our own files |
| Server-side rendering `recharts` | `lodash` CVE — currently client-bundle only |

---

## Known gaps (accepted, not bugs)

- **No automated SQL migrations.** Schema changes are run by hand in the Supabase SQL editor. A
  `supabase/migrations/` directory with a CI drift check is the fix; not scheduled.
- **No tests.** CI gates are typecheck, lint, and image scanning. Highest-value first test is the
  concurrency test on the `claim_due_scheduled_emails` function — the one property that cannot be
  verified confidently by reading code.
- **No rate limiting anywhere.** Not exploitable for spam today because SMTP credentials are per-user,
  but it means one user can exhaust their own Gmail sending quota, and N replicas multiply
  unthrottled SMTP throughput. Consider it when the CronJob batch size is tuned.
