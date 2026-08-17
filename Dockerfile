# syntax=docker/dockerfile:1.7
#
# Multi-stage build for Next.js 15 standalone output.
# Architecture-agnostic: pass --platform=linux/arm64 (Graviton) or amd64 at build
# time. Do NOT hardcode a platform here, or you cannot test locally on x86 and
# ship ARM to EKS from the same file.

# ──────────────────────────────────────────────────────────────────────────────
# base — pinned minor. An unpinned `node:20-alpine` means a base retag silently
# changes your runtime and makes Trivy results non-deterministic.
#
# alpine over slim (~135 MB vs ~200 MB) is safe here specifically because
# next.config.ts sets `images: { unoptimized: true }`, so sharp/libvips is never
# invoked. Switch to -slim the day you enable next/image optimisation: sharp on
# musl is a known source of segfaults.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20.19-alpine AS base
# @next/swc and some prebuilt binaries expect glibc symbol stubs on musl.
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ──────────────────────────────────────────────────────────────────────────────
# deps — isolated so `npm ci` is cached until the lockfile changes.
#
# Copying package files BEFORE the source is the single biggest build-speed win:
# Docker invalidates a layer and everything after it when any copied file
# changes, so `COPY . .` before `npm ci` would re-resolve all dependencies on
# every source edit. ~4 min → ~40 s.
#
# `npm ci` not `npm install`: it installs exactly the lockfile and FAILS if
# package.json and package-lock.json disagree — a free integrity gate. `npm
# install` would silently mutate the lockfile inside the image.
#
# No --omit=dev: the builder genuinely needs typescript (required even to parse
# next.config.ts), tailwindcss, postcss and autoprefixer.
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ──────────────────────────────────────────────────────────────────────────────
# builder
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS builder

# NEXT_PUBLIC_* are string-substituted into the CLIENT bundle at build time, so
# they cannot come from a runtime ConfigMap or Secret. Get this wrong and the
# server works perfectly while every browser login silently fails, because
# createBrowserClient(undefined, undefined) throws in client code you will never
# see in `kubectl logs`. This is the most common Next-on-Kubernetes mistake.
#
# These two are non-secret by design — the anon key is meant to be public and is
# protected by Supabase RLS. NEVER add SUPABASE_SERVICE_ROLE_KEY as an ARG:
# build args are visible in `docker history` and in the build cache.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

# Fail the build in 1 second rather than debug a silently-broken login for an
# hour. A missing build arg otherwise produces an image that builds and boots
# fine and is simply unusable.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL"      || (echo "ERROR: missing build arg NEXT_PUBLIC_SUPABASE_URL" && exit 1) && \
    test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" || (echo "ERROR: missing build arg NEXT_PUBLIC_SUPABASE_ANON_KEY" && exit 1)

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# Measured peak build RSS on this app: 943 MB. 2048 gives headroom on a CI
# runner. (The EC2 box uses 1024 because it is a small instance with swap — that
# was a workaround for a constrained host, not a requirement of the build.)
ENV NODE_OPTIONS=--max-old-space-size=2048

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────────
# runner — note it installs NOTHING. `output: "standalone"` traces the reachable
# server dependencies into .next/standalone/node_modules (62 MB vs 822 MB). That
# is the entire point of standalone output and the biggest size win available.
# ──────────────────────────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    # Kubernetes injects HOSTNAME = the pod name. server.js:9 reads
    # `process.env.HOSTNAME || '0.0.0.0'`, so without an explicit value the app
    # binds to the pod name — unreachable on 127.0.0.1 inside the pod, exec
    # probes fail, and slow hostname resolution surfaces as EADDRNOTAVAIL
    # crash-loops. Pod env OVERRIDES this, so it must ALSO be set in the
    # Deployment spec. Setting it here only covers `docker run`.
    HOSTNAME=0.0.0.0 \
    # Next installs its own SIGTERM handler that exits in ~14 ms (measured).
    # Since SIGTERM and load-balancer endpoint removal are concurrent and
    # unordered, that means the LB is still routing to a closed socket — the real
    # cause of "flaky ALB 502s on every deploy". This hands control to
    # lib/server/shutdown.ts, which fails readiness FIRST, then drains.
    NEXT_MANUAL_SIG_HANDLE=true \
    # Node's default keep-alive is 5 s; an ALB's default idle timeout is 60 s. If
    # Node closes a pooled connection first, the ALB occasionally writes a
    # request onto a socket Node just closed → intermittent 502s with no
    # application log line. Rule: Node keep-alive > LB idle timeout.
    KEEP_ALIVE_TIMEOUT=65000

# Three COPYs are mandatory. Standalone deliberately EXCLUDES .next/static and
# public because it assumes a CDN serves them. Omitting them is the #1
# Next-standalone Docker bug: HTML renders, every /_next/static/** 404s, and you
# get an unstyled non-interactive page with no server-side error.
#
# --chown at COPY time rather than a separate RUN chown -R, which would duplicate
# ~110 MB into an extra layer.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# The node images already ship a `node` user at uid 1000 — no adduser needed.
# Pair with securityContext: { runAsNonRoot: true, runAsUser: 1000,
# allowPrivilegeEscalation: false, capabilities: { drop: [ALL] } }.
USER node

EXPOSE 3000

# No HEALTHCHECK instruction: Kubernetes ignores it entirely (probes live in the
# pod spec). Adding one would only mislead readers.

# EXEC form, never `npm start`. Shell form makes sh/npm PID 1, which does NOT
# forward SIGTERM to node — so every rolling update hangs for the full
# terminationGracePeriodSeconds and ends in SIGKILL, losing in-flight SMTP sends.
CMD ["node", "server.js"]
