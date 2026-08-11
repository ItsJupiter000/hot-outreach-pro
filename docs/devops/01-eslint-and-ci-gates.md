# 01 — Lint Rules and CI Gates

> **Where we are.** Repo hygiene is done. Now we need a pipeline that can say "no" to a bad change.
>
> **What this stage costs in AWS:** still $0. GitHub Actions is free for private repos up to 2,000
> minutes/month; this workflow uses about 2 minutes per run.

---

## 1. The honest problem: there are no tests

Zero. No jest, no vitest, no playwright, no `*.test.ts`, nothing. That is the single most important
constraint on CI design here, and pretending otherwise produces a pipeline that *looks* rigorous and
catches nothing.

So the question isn't "what should CI run" — it's **"what can actually gate a pull request today?"**

| Gate | Verdict | Reasoning |
|---|---|---|
| `npm ci` | **Blocking** | Fails if `package.json` and `package-lock.json` disagree. A free integrity check that costs nothing to add. |
| `tsc --noEmit` | **Blocking — highest value available** | `strict: true` is already on. Verified: it currently passes with **exit 0**, so it can block from day one without a ratchet. In a repo with no tests, this is the only real correctness gate. |
| `eslint .` | **Blocking**, with a warning ratchet | Verified 0 errors / 140 warnings after configuration. See §3. |
| `npm audit --omit=dev --audit-level=critical` | **Blocking** | Currently zero. Small, high-signal. |
| `npm audit` (full) | **Advisory** | Noisy by nature. See §4 — but two findings are real and tracked. |
| `gitleaks` | **Blocking** | A `.env` with a live service-role key and a Gmail app password is in the working tree, one `git add -f` from being public. |
| Docker build + smoke test | **Next document** | Requires the Dockerfile, which is Stage 1.3. |

What is *not* on this list matters as much: no coverage threshold (there is nothing to cover), no
"all tests must pass" step that would trivially succeed on an empty test suite. A green checkmark
should mean something.

---

## 2. Why `next lint` had to go

`package.json` declared `"lint": "next lint"`, but **there was no ESLint configuration file at all.**
Run it non-interactively and it prompts for setup, then fails. So the lint script has never worked in
this repo — which is a useful thing to know before writing a workflow that depends on it.

Two changes:
- Added `eslint.config.mjs` (flat config — the format ESLint 9+ uses).
- Changed the script to `"lint": "eslint ."`. **`next lint` is deprecated in Next 15 and removed in
  Next 16**, so building CI on it would mean rewriting this within one major version.

`eslint-config-next` is still authored in the older "eslintrc" format, so the config uses
`FlatCompat` from `@eslint/eslintrc` as the official bridge. That's the one piece of boilerplate in
the file.

---

## 3. Four rules that would each have prevented a real bug

Generic style rules are noise — they generate hundreds of findings about spacing that nobody reads.
These four are specific to mistakes **this codebase has already made**.

### Rule 1 — Server code may not import `fs`

```
lib/server/scheduledService.ts
  1:1  error  'fs' import is restricted from being used.
              Server code must be stateless — no local filesystem writes.
```

The rule fired immediately on the exact file that is Blocker #1 of the whole migration.
`scheduledService.ts` stores the pending-email queue in `persistent_data/scheduled_emails.json`. Two
consequences:

- **It cannot scale.** Each replica gets its own file, so three replicas have three different queues.
- **It loses email.** `popDueEmails()` writes the remaining items back to disk *before* attempting any
  send. Crash in between and those emails are gone — no record, no retry, no trace. That is a live
  bug on the current single-instance EC2 box, with nothing to do with Kubernetes.

This is the highest-value rule in the file, because the failure mode is **silent**: local-disk state
works perfectly on one replica and corrupts data on three. There is no error message, no stack trace
— just occasional missing or duplicated emails that look like a mail-provider problem.

The one existing violation carries an `eslint-disable-next-line` with a comment explaining what it is
and when it goes away. That's deliberate: **the rule stays a hard error for all new code**, and
deleting that disable comment becomes part of the Stage 5.1 migration. Weakening the rule to a
warning instead would have let the mistake recur.

### Rule 2 — `lib/` may not import from `app/`

`lib/server/scheduledService.ts:80` does:

```ts
const { executeEmailSend } = await import("@/app/api/send-email/route");
```

A library reaching *up* into a Next.js route module. Dependencies should point one way:
`app/` (delivery) depends on `lib/` (logic), never the reverse.

Why it matters practically: this inversion is what makes it expensive to run the background sweep as
a standalone worker process. Importing that function drags the entire Next.js route machinery into
what should be a plain Node script. The fix — moving `executeEmailSend` into
`lib/server/emailSendService.ts` — is cheap now and would be a multi-day untangle later.

### Rule 3 — Centralize `process.env` (currently a warning)

There are ~26 raw `process.env` reads across 7 files. Two specific problems this causes:

- **`CRON_SECRET` is read at `app/api/cron/route.ts:10` and defined in no `.env` file.** The guard is
  written `if (cronSecret && authHeader !== ...)`, so an unset value makes the condition
  short-circuit to false and the endpoint is **fully open to the internet** — anyone can trigger
  email sends for every user in the system, from a curl loop.
- **`MY_NAME`, `MY_EMAIL`, and `NEXT_PUBLIC_HOST` are read by code and appear in no `.env` file.**

Scattered reads make startup validation impossible. Once `lib/server/env.ts` exists (Stage 5) with a
zod schema, a missing required variable crashes the pod at boot with a clear message —
`CrashLoopBackOff` you can read — instead of throwing a 500 at 3am on the first cron tick.

It's a **warning** for now because `env.ts` doesn't exist yet, so there's nowhere compliant to point.
It becomes an error when it does.

### Rule 4 — deferred: `no-floating-promises`

Not enabled yet. It requires type-aware linting (`projectService`), which is substantially slower.
It's worth adding scoped to `lib/` and `app/api/` later, because in an application whose entire job
is sequencing async side effects, **an unawaited promise is a silently dropped email.**

---

## 4. The warning ratchet — the important trade-off in this config

After configuration: **0 errors, 140 warnings.**

The 140 are pre-existing debt — 59 `any` usages (mostly the snake_case↔camelCase row mappers in
`lib/server/storage.ts` and every `catch (err: any)`) and ~51 unused variables.

Those rules ship as **warnings, not errors**, and CI runs `eslint . --max-warnings 140`. The
reasoning:

- If `no-explicit-any` stayed an error, **every pull request would fail** for 59 reasons unrelated to
  that pull request. A gate that is always red is a gate everyone learns to ignore — and then it
  catches nothing when it matters.
- As warnings with a pinned ceiling, a PR that adds a **141st** warning fails. So the debt cannot
  grow, but nobody is blocked on cleaning up debt they didn't create.
- The architectural rules from §3 remain **hard errors**, so the things that actually matter block.

This is a **ratchet, not a threshold**: lower the number as debt is paid down, never raise it. The
number in `ci.yml` is the current count, and it should only ever go down.

The alternative — "make eslint non-blocking entirely for now" — is worse. A non-blocking lint step is
decoration; nobody reads a green-with-warnings log. Pinning the count makes it enforceable today.

---

## 5. ⚠️ npm audit found two things that are not noise

`npm audit --omit=dev --audit-level=critical` returns **zero**, which is why it's safe as a blocking
gate. But the full report has 9 advisories, and **two of them are directly exploitable in this
application**:

### `next` — HIGH, affects 9.3.4 through 16.3.0-preview.10 (this app runs 15.5.14)

The advisory list includes several **"Middleware / Proxy bypass in App Router applications"** entries.

Why that is severe *here specifically*: this app's entire authorization model is
`middleware.ts` → `lib/supabase/middleware.ts`, which calls `auth.getUser()` and redirects
unauthenticated requests to `/login`. **A middleware bypass in this app is an authentication
bypass.** Combined with the fact that all server code uses the Supabase *service-role* key (which
bypasses Row Level Security entirely), there is no second line of defence behind the middleware.

Also relevant: cache-poisoning and SSRF advisories, both of which get more exploitable once the app
sits behind a public ALB.

### `nodemailer` — HIGH, affects ≤ 9.0.0 (this app runs ^8.0.1)

Includes **SMTP command injection via CRLF** and **arbitrary message header injection via CRLF in
`List-*` header comments**.

Why that is severe here: sending email *is* this application's function, and it builds messages from
user-controlled input — company names, recipient addresses, and template bodies with `{{variable}}`
substitution. Header injection in an outreach tool means an attacker can add recipients, forge
`From`/`Reply-To`, or inject content into mail sent from your domain — which is also a fast way to
destroy the sending reputation the recent deliverability commits were working to build.

### Recommendation

**Upgrade both before the app goes on a public ALB.** This should be its own change, not folded into
the pipeline work, because:
- `nodemailer` needs 9.x — a **major** bump from `^8.0.1`, so the API surface needs checking against
  `lib/server/mailService.ts` and `lib/server/imapService.ts`.
- `next` needs a newer release, which means re-verifying the build, the middleware behaviour, and the
  standalone output.

`postcss` and `sharp` also have HIGH advisories but are build-time/unused here (`images.unoptimized:
true` means sharp is never invoked), so they're genuinely lower priority — a good illustration of why
raw audit severity is a poor prioritization signal on its own.

---

## 6. Workflow design notes

A few choices in `.github/workflows/ci.yml` worth explaining:

**`node-version-file: .nvmrc`** rather than `node-version: 20`. One source of truth. Hardcoding the
version in the workflow is how local/CI/image drift starts — and drift between npm majors can
resolve the lockfile differently, producing "works locally, fails in CI" with no visible cause.

**`cache: npm`** caches `~/.npm` (the download cache), keyed on `package-lock.json` — not
`node_modules`. `npm ci` still does a clean install, which is the point; only the network fetch is
skipped. ~60s → ~15s.

**`--incremental false` on `tsc`** is not optional. `tsconfig.tsbuildinfo` records which files were
already checked, and a stale one makes `tsc` **silently skip files**. A typecheck that checks nothing
and exits 0 is worse than no typecheck.

**`concurrency` with `cancel-in-progress`** — push three times in a minute and you'd otherwise run
three full pipelines and wait on results you no longer care about.

**`permissions: contents: read`** — least privilege. The repo default can be read/write on
everything. This job only reads code. Stage 2 will add `id-token: write` (for OIDC to AWS) and
`contents: write` (for the manifest bump) as explicit, scoped additions.

**`paths-ignore: deploy/**`** — added *now*, before `deploy/` exists. Once ArgoCD is wired up, CI
will commit an image-tag bump into `deploy/values-prod.yaml`. Without this filter that commit
re-triggers CI, which builds and bumps again: an infinite loop that burns Actions minutes and pushes
garbage commits. Adding it in advance means we can't forget.

**`fetch-depth: 0`** on checkout — gitleaks scans commit history, not just the working tree. The
default shallow clone would make it scan almost nothing.

---

## 7. An incidental lesson: `npm ci --dry-run` is not dry

While verifying these gates, `npm ci --dry-run` under **npm 9.2.0** deleted `node_modules` anyway,
breaking the local ESLint install (which then fell back to fetching a different ESLint major from the
registry and failing on a missing peer).

`npm ci` legitimately removes `node_modules` before installing — that's its contract. The bug is that
npm 9 performs the removal even with `--dry-run`. It's fixed in npm 10.

Concretely: this is another argument for the Node 20 / npm 10 switch described in
`00-prerequisites.md`, and a reminder that "dry run" is a promise made by the tool, not a guarantee.

---

## Verify this stage

```bash
npm ci                                    # must succeed (lockfile consistent)
npx tsc --noEmit --incremental false      # exit 0
npx eslint . --max-warnings 140           # exit 0, 140 warnings
npm audit --omit=dev --audit-level=critical   # exit 0
```

Then push a branch and open a PR — the workflow should run and pass. To prove the gates actually
work, deliberately break one:

```bash
# Should FAIL the lint gate with the restricted-import error:
echo 'import fs from "fs";' >> lib/server/storage.ts
```

A gate you've never seen fail is a gate you don't know works.

**Next:** `02-dockerfile.md` — turning the app into an immutable, reproducible artifact, and the four
Next.js-standalone-on-Kubernetes traps.
