# 00 — Prerequisites and Repo Hygiene

> **Where we are.** The app runs on a single EC2 instance under PM2, deployed by SSHing in and
> running `redeploy.sh`. Before we can containerize anything, we need a toolchain and we need the
> repository to stop lying to us about what it depends on.
>
> **What this stage costs in AWS:** $0. Nothing is provisioned yet.

---

## 1. Why the current deployment has to change

It's worth being precise about what's actually wrong, because "we should use Kubernetes" is not a
reason — it's a conclusion looking for one.

`redeploy.sh` does this:

```bash
git pull origin main
npm ci --production=false
export NODE_OPTIONS="--max-old-space-size=1024"
npm run build          # ← on the production host
pm2 restart hot-outreach-pro
```

Four concrete failure modes:

1. **The build happens on the production host.** `next build` on this app needs a 2 GB swapfile and a
   capped heap just to finish. While it runs, it's competing with the live app for RAM on the same
   box. If it OOMs halfway, you have a half-written `.next` directory and a running app that will
   serve broken chunks the moment PM2 restarts it.

2. **There is no rollback.** `git pull` is forward-only. To roll back you `git checkout` an older
   SHA and rebuild — 3–5 minutes of a broken production site, assuming the older build even succeeds
   on the first try.

3. **The deploy is not reproducible.** It depends on whatever `npm ci` resolves today, whatever Node
   version happens to be installed, and whatever files are lying around in the working directory. Two
   deploys of the same commit can produce different running code.

4. **A failed step leaves an undefined state.** `set -e` aborts the script, but PM2 is still running
   the old process against a possibly-mutated `.next`. There's no "all or nothing".

Containers fix 1, 3, and 4 by making the build artifact **immutable and built elsewhere**. Kubernetes
fixes 2 by keeping the previous ReplicaSet around so a rollback is a pointer change, not a rebuild.
That's the actual argument — not that Kubernetes is modern.

---

## 2. Toolchain

Already present on this machine:

| Tool | Version | Used for |
|---|---|---|
| `docker` | 29.5.3 | Building the image |
| `docker buildx` | 0.34.1 | Cross-building ARM64 on this x86_64 host |
| `kubectl` | v1.36.1 | Talking to the cluster |
| `node` | v22.22.1 | ⚠️ see §4 — the app targets Node 20 |
| `jq` | 1.8.1 | Parsing AWS CLI JSON output |

Still needed:

| Tool | Why |
|---|---|
| `aws` (CLI v2) | Authentication, ECR login, EKS kubeconfig |
| `terraform` | All infrastructure as code |
| `helm` | Packaging and templating the Kubernetes manifests |
| `eksctl` | Not used to create the cluster — but its diagnostic subcommands (`eksctl utils describe-stacks`) are genuinely useful when a cluster won't come up |
| `argocd` | CLI for the GitOps controller |
| `gh` | Setting GitHub Actions secrets/variables from the terminal |

### Why Terraform, and not the alternatives

This is the first real fork in the road, so it's worth spending a paragraph on.

| Option | Why not |
|---|---|
| **CloudFormation** | AWS-native, no state file to manage, and drift detection is built in. But the YAML/JSON is verbose, the error messages are famously unhelpful, and a failed stack update can wedge in `UPDATE_ROLLBACK_FAILED` requiring manual intervention. Critically: it's AWS-only, so nothing you learn transfers. |
| **AWS CDK** | Real TypeScript with types and loops — genuinely pleasant, and you already know TS. But it compiles *down* to CloudFormation, so you inherit every CloudFormation failure mode plus a compilation step between you and the thing that broke. That extra layer is bad when you're learning, because the error you see is two translations away from the code you wrote. |
| **Pulumi** | Same "real programming language" benefit, without the CloudFormation backend. Technically excellent. Loses on ecosystem: far fewer examples, fewer Stack Overflow answers, and a much smaller module registry — which matters a lot when you're stuck. |
| **`eksctl`** | One command creates a working cluster. Perfect for a demo. But it's a purpose-built cluster tool, not a general IaC tool — it won't manage your S3 bucket, Secrets Manager entries, Route 53 records, or IAM roles. You'd end up with half your infrastructure in `eksctl` YAML and half in something else. |
| **Terraform** ✅ | Multi-cloud, declarative, by far the largest module ecosystem (`terraform-aws-modules/*` is effectively the industry standard), the most examples, and the most employable — it's what job postings ask for. The cost is a real one: you own the state file, and losing it is genuinely painful. Stage 3 addresses that with a versioned S3 backend and locking. |

The honest summary: CDK is the nicest to *write*, Terraform is the best to *learn*. We're optimizing
for the second.

### Installing

```bash
# AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install

# Terraform + others via the HashiCorp apt repo
wget -O- https://apt.releases.hashicorp.com/gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
  https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install -y terraform

# Helm
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# GitHub CLI
sudo apt install -y gh
```

Verify with `aws sts get-caller-identity` — if that returns your account ID, authentication works.

> **Don't skip this check.** Almost every confusing Terraform failure in Stage 3 traces back to
> credentials resolving to a different account or region than you assumed.

---

## 3. What we changed in the repo, and why

### `tsconfig.tsbuildinfo` is no longer tracked

This is TypeScript's incremental-compilation cache — a 208 KB record of "which files did I already
check". It was committed in the initial commit before `.gitignore` took effect.

Why it matters beyond tidiness: **a stale `tsbuildinfo` makes `tsc --noEmit` skip files it believes
are unchanged.** Since `tsc --noEmit` is going to be our primary CI correctness gate (there are no
tests), a type-check that silently checks nothing is worse than no type-check — it produces a green
checkmark that means nothing.

`git rm --cached` removes it from Git's index while leaving it on disk, so your local incremental
builds stay fast.

> **A note on history rewriting.** You'll read advice to use `git filter-repo` or BFG to purge
> artifacts from history. **Not here.** The entire `.git` directory is 606 KB and this blob is ~200 KB
> — rewriting history invalidates every commit SHA from that point forward, breaking every clone,
> fork, and open PR, and requires a coordinated force-push.
>
> History rewriting is justified for exactly two things: **leaked credentials**, and blobs large
> enough to make cloning painful. And if credentials ever *do* get committed, the correct first move
> is **rotate the key** — rewriting history without rotating is security theatre, because the old
> objects still exist in every clone and in GitHub's fork network.

### `.nvmrc` pins Node 20

There was **no** Node version signal anywhere in the repo — no `engines`, no `.nvmrc`. The only hint
was `deploy.sh` installing Node 20 from NodeSource. Meanwhile this machine runs **Node 22.22.1 with
npm 9.2.0**.

That gap is a real hazard, not a theoretical one. If npm 9 regenerates `package-lock.json`, it can
resolve dependencies differently than the npm 10 that ships with Node 20 in the Docker image. You get
the classic "works on my machine, fails in CI" loop, and the cause is invisible because both
lockfiles look plausible.

Pinning it in three places makes the drift impossible to reintroduce: `.nvmrc` (for `nvm use`),
`engines` in `package.json` (advisory), and the Dockerfile base image (authoritative).

### `engines` added — but deliberately *not* `engine-strict`

`package.json` now declares `"node": "20.x"`. By default npm treats this as **advisory** — it warns
and continues.

You can make it a hard error by adding `.npmrc` with `engine-strict=true`. **We haven't, on purpose:**
your machine is on Node 22, so turning it on right now would immediately break `npm install` locally
until you switch. That's a decision for you to make, not for me to spring on you.

The tradeoff:
- **Advisory (now):** nothing breaks; the drift risk remains.
- **Strict:** run `nvm install 20 && nvm use 20`, then add `engine-strict=true`. The drift becomes
  structurally impossible.

Strict is the right end state. Flip it when you're ready to move your local Node to 20.

### `.env.example` reorganized into three labelled sections

Not cosmetic — the sections encode a distinction that will bite otherwise.

**`NEXT_PUBLIC_*` variables are build-time.** Next.js performs a literal string substitution of these
into the JavaScript that gets sent to the browser, during `next build`. By the time a container
starts, that substitution already happened.

The practical consequence: **you cannot supply `NEXT_PUBLIC_SUPABASE_URL` via a Kubernetes ConfigMap
or Secret.** If you try, the server side will work fine and every browser login will silently fail,
because `createBrowserClient(undefined, undefined)` throws in client code where you won't see it in
your pod logs. This is the single most common Next.js-on-Kubernetes mistake, and the failure is
near-invisible. They go in the Dockerfile as `ARG`s.

Four variables were being read by code but documented nowhere — `CRON_SECRET`, `MY_NAME`, `MY_EMAIL`,
and `NEXT_PUBLIC_HOST`. They're now documented (except `NEXT_PUBLIC_HOST`, which is read in exactly
one place that we're deleting in Stage 5).

And `NEXT_PUBLIC_APP_URL` was configured in both `.env` files but **read by no code at all** — dead
since the tracking pixel was removed. Rather than delete it, it now has a real job: it's the fix for
a bug we found during analysis. `app/auth/callback/route.ts` derives its redirect origin from
`request.url`, which behind a TLS-terminating ALB yields `http://` — so the post-login redirect
downgrades the scheme and any `Secure` cookie set on that response is dropped. Deriving the origin
from a configured canonical URL is the correct behind-a-proxy pattern, and it also closes a
Host-header-injection vector on the redirect target.

### `.gitignore` additions

`tsconfig.tsbuildinfo`, plus Terraform's `.terraform/`, `*.tfstate*`, and `*.tfvars`.

Adding the Terraform entries *now*, before any Terraform exists, is deliberate. **`terraform.tfstate`
contains every value Terraform manages in plaintext — including secrets.** Committing it is a
credential leak. The window in which you can make that mistake is between "I write my first `.tf`
file" and "I remember to gitignore state", and closing it in advance costs nothing.

---

## 4. Deliberately deferred

Two items from the plan that look like they belong here but don't:

**Removing dead dependencies** (`node-cron`, `@types/node-cron`, `zod-validation-error` — all three
confirmed unimported). `npm uninstall` rewrites `package-lock.json`, and doing that under npm 9 when
the image will use npm 10 is exactly the drift we just spent a section avoiding. This happens after
the Node 20 switch, so the lockfile is written by the same npm that reads it in CI.

**`eslint.config.mjs`.** There is no ESLint config at all, which means `npm run lint` (`next lint`)
prompts interactively for setup and therefore *cannot* run in CI. Worth its own step, because the
interesting part isn't the config — it's choosing four repo-specific rules that would each have
prevented a bug we actually found. That's the next document.

---

## Verify this stage

```bash
git status --short
#  M .env.example
#  M .gitignore
#  M package.json
#  D  tsconfig.tsbuildinfo     ← staged deletion from the index only
#  ?? .nvmrc

test -f tsconfig.tsbuildinfo && echo "still on disk (correct)"
npm run check                  # tsc --noEmit should still pass
```

Nothing here changes runtime behaviour, so this is safe to deploy to the EC2 box immediately — and
you should, to confirm the pipeline of "small safe change → deploy → nothing breaks" still works
before we start changing anything that matters.

**Next:** `01-eslint-and-ci-gates.md` — what can honestly gate a pull request in a repository with
zero tests.
