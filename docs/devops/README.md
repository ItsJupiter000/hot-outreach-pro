# DevOps Roadmap — EC2 + PM2 → AWS EKS with GitOps

Read the numbered docs in order. Each one explains **what** we built, **why**, what the
**alternatives** were, and why the choice won.

---

## Where we started

One EC2 instance. Someone SSHes in and runs `redeploy.sh`: `git pull` → `npm ci` → `npm run build`
**on the production host** → `pm2 restart`. nginx on :80 proxies to `127.0.0.1:3000`.

Four concrete problems, and they're the reason for everything that follows:

| Problem | Consequence |
|---|---|
| Build runs on the production host | It needs a 2 GB swapfile and a capped heap just to finish, competing with the live app for RAM. OOM halfway = half-written `.next` + a running app about to serve broken chunks |
| No rollback | `git pull` is forward-only. Rolling back means checking out an old SHA and rebuilding — minutes of downtime, assuming the old build even succeeds |
| Not reproducible | Depends on whatever `npm ci` resolves today, whatever Node is installed, and whatever files are lying around. Two deploys of the same commit can produce different running code |
| No atomicity | `set -e` aborts, but PM2 still runs the old process against a possibly-mutated `.next`. There is no "all or nothing" |

Containers fix 1, 3 and 4 by making the artifact **immutable and built elsewhere**. Kubernetes fixes
2 by keeping the previous ReplicaSet, so rollback is a pointer change, not a rebuild. That's the
argument — not "Kubernetes is modern".

---

## The three blockers

Worth internalizing early, because they shape the whole sequence. **The app currently cannot run as
more than one replica.** Not an infrastructure problem — an application problem.

1. **Local-disk email queue.** `lib/server/scheduledService.ts` keeps pending scheduled emails in
   `persistent_data/scheduled_emails.json`. Three replicas = three separate queues. And
   `popDueEmails()` deletes due rows *before* attempting the send, so a crash loses them permanently.
   **That is a live bug today**, with nothing to do with Kubernetes.

2. **In-process scheduler in every replica.** `instrumentation.ts` runs a 60-second `setInterval` in
   *every* server process, coordinated only by advisory timestamps read-then-written — a check-then-act
   race. **3 replicas ⇒ every email sent up to 3×.**

3. **No health endpoint, no graceful shutdown.** Probing `/` returns a 307 redirect (which Kubernetes
   counts as *success*, so the probe can never fail), and there are zero `SIGTERM` handlers, so
   rolling updates kill in-flight sends mid-write.

**This is why we deploy to EKS at `replicas: 1` first**, prove the pipeline end to end, and only then
fix the blockers and turn on autoscaling. Scaling before Stage 5 would send duplicate emails to real
recipients.

---

## Milestones

Legend: 🔵 = I do it · 🟡 = you do it · ⚪ = together

### ✅ Stage 0 — Foundations · $0 · **done**

Toolchain, repo hygiene, ESLint, CI gates.

**Why first:** you cannot containerize a repo that lies about its dependencies, and you cannot safely
change anything without a gate that says "no". Also: `tsc --noEmit` passes at exit 0 today, so it can
block from day one — worth knowing before relying on it.

Docs: `00-prerequisites.md`, `01-eslint-and-ci-gates.md`

---

### ✅ Stage 1 — Security upgrades · $0 · **done**

`next` 15.5.14 → **15.5.23**, `nodemailer` 8.0.4 → **9.0.5**, `imapflow` → 1.6.6, `postcss` → 8.5.26.

**Why before the Dockerfile:** this app's entire authorization model is `middleware.ts`, and because
all server code uses the Supabase service-role key, RLS is bypassed — there is **no second line of
defence** behind the middleware. A middleware bypass is an auth bypass. Baking that into an immutable
image and putting it on a public ALB is the wrong order of operations.

**The finding worth remembering:** `npm audit` recommended Next **16.3.0** (`isSemVerMajor: true`),
which would have forced a React 18 → 19 migration. But npm's `fixAvailable` is the version that
clears *all* advisories including **inherited** ones, so it systematically over-recommends majors.
Checking `via` after upgrading to the `backport` dist-tag (15.5.23) gave `["postcss","sharp"]` — plain
strings, no advisory objects — meaning **every direct Next.js CVE was already fixed**. Four residual
advisories remain, all verified unreachable (`sharp` never invoked because `images.unoptimized: true`;
`ws` never instantiated because the app uses no Supabase Realtime).

Doc: `02-security-upgrades.md` — includes the reachability method, and four measurements that shape
the Dockerfile (943 MB peak build RSS, the `.env`-in-standalone leak, the `HOSTNAME` inversion, and
SIGTERM exiting in 14 ms with no drain).

🟡 **still to do: send one real email end to end.** `tsc` and `next build` prove it compiles against
nodemailer 9; they cannot prove the SMTP conversation works.

---

### Stage 2 — Container-ready app · $0

Health/readiness endpoints, graceful shutdown, Dockerfile, `.dockerignore`, container smoke test in CI.

**Why:** the immutable artifact everything downstream depends on. Four traps we'll cover in detail:
Kubernetes injects `HOSTNAME` = pod name (so the server binds to the wrong address);
`NEXT_PUBLIC_*` are inlined at *build* time, so a runtime ConfigMap silently ships a broken frontend;
`next build` copies `.env` into the standalone output (so `.dockerignore` is a **secret-leak
control**, not hygiene); and `CMD npm start` means SIGTERM never reaches Node.

**Verify:** `docker run` → `curl /api/health` = 200, app renders, `docker stop` exits in ~15s.

🔵 all of it · 🟡 review the Dockerfile with me — it's the most transferable artifact here

---

### Stage 3 — Registry + CI/CD to AWS · ~$1/mo

ECR repository (Terraform), GitHub OIDC federation, CI builds and pushes an ARM64 image tagged by git
SHA.

**Why OIDC matters:** the alternative is storing a long-lived `AWS_ACCESS_KEY_ID` in GitHub secrets.
OIDC issues short-lived credentials per run against a trust policy scoped to your repo and branch —
nothing to leak, nothing to rotate.

**Why git SHA and never `latest`:** a mutable tag makes "what is actually deployed?" unanswerable and
breaks rollback entirely.

🟡 **AWS account + region**, install `aws`/`terraform`, confirm `aws sts get-caller-identity`
🔵 Terraform, workflow, trust policy

---

### Stage 4 — AWS infrastructure · ~$110-150/mo when running

Terraform state backend (S3 + locking), VPC (2 AZs, one NAT), EKS cluster, Karpenter, addons.

**Why 2 AZs and one NAT:** deliberate cost/HA trade — one NAT is ~$35/mo vs ~$105 for one per AZ. A
documented single point of failure for a learning cluster; the doc says exactly what you'd change for
production.

**The key concept:** there are **two independent autoscaling layers**. HPA/VPA is pod-level ("how
many pods, how big?"). Karpenter is node-level ("is there anywhere to put them?"). HPA without
cluster autoscaling gives you `Pending` pods forever. You need both.

🟡 approve the cost, confirm region
🔵 all Terraform · ⚪ first `terraform apply` together, so you see the plan output

---

### Stage 5 — Helm, secrets, TLS, ArgoCD · +~$5/mo

Helm chart, AWS Secrets Manager + External Secrets Operator, ALB Ingress + ACM certificate + Route 53,
ArgoCD.

**Why ArgoCD (pull-based) over `kubectl apply` in CI (push-based):** with GitOps, the cluster pulls
from Git, so **CI never needs cluster credentials**. Git becomes the single source of truth for what's
deployed, drift is detected and self-healed, and rollback is `git revert`.

**First deploy is `replicas: 1` and `helm install` by hand** — before ArgoCD — so you see what ArgoCD
later automates.

Goes live at `staging.<yourdomain>`. **Production EC2 keeps serving the apex the whole time.**

🟡 domain name + whether DNS is in Route 53 or delegated
🔵 chart, secrets wiring, ArgoCD

---

### Stage 6 — Now make it scale · $0 extra

**This is the stage that fixes the three blockers**, and the most interesting engineering in the project.

- **Queue → Postgres.** A `scheduled_emails` table with an atomic claim via `FOR UPDATE SKIP LOCKED`
  inside a Postgres function called through `supabase.rpc()` (necessary because PostgREST is stateless
  — each HTTP call is its own transaction, so you cannot hold a lock across calls). State machine
  `pending → claimed → sent | failed`, so a row is **never** removed before a confirmed send. Fixes the
  data-loss bug.
  **Lucky break:** the queue file currently contains `[]`. Migrate while it's empty and the backfill,
  dual-write, and lost-message window all disappear.
- **Kill the `setInterval`**, replace with a Kubernetes CronJob hitting the in-cluster Service — so
  `CRON_SECRET` never leaves the VPC and `concurrencyPolicy: Forbid` gives singleton semantics from
  Kubernetes rather than app code. Make `/api/cron` **fail closed** (it's `if (secret && ...)` today,
  so an unset secret disables auth entirely).
- **Security fixes in the same commits** — the cross-tenant scheduled-email read/delete/send bugs, and
  the follow-up IDOR. We're editing those exact lines anyway.
- **HPA + VPA.** VPA in *recommender* mode only — both acting on CPU fight each other.
- **S3 for resumes** with EKS Pod Identity, private bucket + presigned URLs.

**Only now is horizontal scaling safe.**

🔵 all code · 🟡 run two SQL migrations in the Supabase console (there's no migration runner — a
documented gap, not something I'm pretending is solved)

---

### Stage 7 — Operate and cut over · ~$5-15/mo

Prometheus + Grafana, Fluent Bit → CloudWatch Logs, security hardening, DNS cutover, teardown/rebuild.

**Cutover:** low-TTL Route 53 flip. Rollback is a DNS change. **Verify SMTP egress works from EKS
before committing** — AWS throttles outbound port 25 by default, and email delivery is the whole
point of this app.

Then `make destroy` / `make up` so you can turn the cluster off when you're not learning. Survives
teardown: Terraform state, ECR images, S3 bucket, Route 53 zone, Secrets Manager.

🟡 the DNS flip · 🔵 everything else

---

## Running cost estimate

| Stage | Monthly if left running |
|---|---|
| 0-2 | **$0** |
| 3 | ~$1 (ECR storage) |
| 4 | ~$110-150 (EKS control plane $73 + 2× t4g.small SPOT ~$10 + NAT $35 + data) |
| 5 | +~$5 (ALB) |
| 6-7 | +~$5-15 (S3, CloudWatch Logs, Secrets Manager) |

Realistic total: **~$130-170/mo running continuously**, or roughly **$10-20/mo** if you destroy the
cluster when not actively working and rebuild from Terraform in ~20 minutes. Stage 7 makes that a
single command.

---

## What is deliberately NOT in scope

Stated plainly so it isn't mistaken for an oversight:

- **Amazon RDS.** Supabase stays. It *is* managed Postgres and works fine from EKS. Migrating would
  mean rewriting every query off `supabase-js` **and** replacing Supabase Auth — a large application
  rewrite that would delay all the CI/CD learning. The plan leaves a clean seam for it later.
- **Tests.** There are none. CI gates are typecheck + lint + image scan. I'll recommend the
  highest-value first tests (the concurrency test on the claim function is the one that matters most)
  but won't pretend the pipeline is test-gated.
- **Automated SQL migrations.** Run by hand in the Supabase console. Documented as a gap with a
  proposed fix.
- **Encrypting `profiles.smtp_pass`.** Currently plaintext and returned by `GET /api/profile`.
  Tracked in `security-backlog.md`.
