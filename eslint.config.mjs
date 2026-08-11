import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next is still authored in the legacy "eslintrc" format.
// FlatCompat is the official bridge that lets flat config consume it.
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/**",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ───────────────────────────────────────────────────────────────────────────
  // Repo-specific architectural rules.
  //
  // These are NOT style rules. Each one would have prevented a bug that this
  // codebase actually has. Generic style linting is noise; these are guardrails
  // around the specific mistakes this project has already made.
  // ───────────────────────────────────────────────────────────────────────────

  // RULE 1 — Server code must never touch the local filesystem.
  //
  // Why: lib/server/scheduledService.ts stored the pending-email queue in
  // persistent_data/scheduled_emails.json. That single design choice is why the
  // app cannot run as more than one replica, and why it loses emails on crash
  // (popDueEmails deletes rows BEFORE attempting the send).
  //
  // Once Stage 5.1 moves that queue into Postgres, this rule makes the mistake
  // structurally unrepeatable. A lint rule that prevents the return of
  // local-disk state is worth more than a hundred formatting rules, because the
  // failure mode is silent: it works perfectly on one replica and corrupts data
  // on three.
  {
    files: ["lib/**/*.{ts,tsx}", "app/**/*.{ts,tsx}", "instrumentation.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "fs",
              message:
                "Server code must be stateless — no local filesystem writes. Persist to Supabase (or S3 for blobs) instead. See docs/devops/01-eslint-and-ci-gates.md",
            },
            {
              name: "node:fs",
              message:
                "Server code must be stateless — no local filesystem writes. Persist to Supabase (or S3 for blobs) instead.",
            },
            {
              name: "fs/promises",
              message:
                "Server code must be stateless — no local filesystem writes. Persist to Supabase (or S3 for blobs) instead.",
            },
            {
              name: "node:fs/promises",
              message:
                "Server code must be stateless — no local filesystem writes. Persist to Supabase (or S3 for blobs) instead.",
            },
          ],
        },
      ],
    },
  },

  // RULE 2 — lib/ must never import from app/.
  //
  // Why: lib/server/scheduledService.ts:80 does
  //   await import("@/app/api/send-email/route")
  // A library reaching into a Next.js route module. That inversion is what makes
  // it expensive to run the background sweep as a standalone worker process —
  // importing it drags the entire Next route machinery into a plain Node script.
  //
  // Dependencies must point one way: app/ (delivery) depends on lib/ (logic).
  {
    files: ["lib/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app", "../app/*", "../../app/*"],
              message:
                "lib/ and shared/ must not import from app/. Dependencies point one way: app/ → lib/. Move the shared logic into lib/ and have the route import it.",
            },
          ],
          paths: [
            { name: "fs", message: "Server code must be stateless — no local filesystem writes." },
            { name: "node:fs", message: "Server code must be stateless — no local filesystem writes." },
            { name: "fs/promises", message: "Server code must be stateless — no local filesystem writes." },
            { name: "node:fs/promises", message: "Server code must be stateless — no local filesystem writes." },
          ],
        },
      ],
    },
  },

  // RULE 3 — Centralize process.env access.
  //
  // Why: there are ~26 raw process.env reads across 7 files, including
  // CRON_SECRET (which gates a publicly reachable endpoint and is currently
  // UNSET, leaving it open) and MY_NAME / MY_EMAIL / NEXT_PUBLIC_HOST, which
  // appear in no .env file at all. Scattered reads make it impossible to
  // validate configuration at startup.
  //
  // Currently a WARNING, not an error: lib/server/env.ts does not exist yet
  // (Stage 5). Once it does, this becomes an error and the pod fails fast on
  // bad config instead of throwing a 500 at 3am on the first cron tick.
  {
    files: ["lib/**/*.ts", "app/**/*.ts", "instrumentation.ts", "middleware.ts"],
    rules: {
      "no-restricted-properties": [
        "warn",
        {
          object: "process",
          property: "env",
          message:
            "Read configuration from lib/server/env.ts (zod-validated at startup) rather than process.env directly. Tracked in docs/devops/01-eslint-and-ci-gates.md — currently a warning until env.ts lands in Stage 5.",
        },
      ],
    },
  },

  // Config files, scripts, and the env module itself legitimately read raw env.
  // Tailwind's plugin array also genuinely requires `require()`.
  {
    files: [
      "next.config.ts",
      "tailwind.config.ts",
      "postcss.config.js",
      "eslint.config.mjs",
      "lib/server/env.ts",
      "lib/supabase/client.ts",
      "scripts/**/*.ts",
    ],
    rules: {
      "no-restricted-properties": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Pre-existing debt: downgraded to warnings so CI can be GREEN and BLOCKING.
  //
  // This is the important trade-off in this file. There are 59 `any` usages and
  // ~51 unused variables already in the codebase (the row mappers in
  // lib/server/storage.ts and every `catch (err: any)`). Leaving them as errors
  // means the lint gate fails on every pull request for reasons unrelated to
  // that pull request — and a gate that is always red is a gate everyone learns
  // to ignore.
  //
  // Making them warnings means:
  //   • `eslint .` exits 0, so CI can BLOCK on real errors from day one
  //   • the architectural rules above stay hard errors for all new code
  //   • the debt is still counted and visible in every CI run
  //
  // The ratchet: once the count is driven down, run CI with
  // `--max-warnings <n>` and lower `n` over time. That converts a static
  // backlog into a one-way ratchet without ever blocking unrelated work.
  // ───────────────────────────────────────────────────────────────────────────
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
