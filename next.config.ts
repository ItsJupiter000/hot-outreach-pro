import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["nodemailer", "imapflow", "node-cron"],
  images: {
    unoptimized: true,
  },

  // Linting is owned by CI (.github/workflows/ci.yml), not by the build.
  //
  // Two reasons this is not laziness:
  //
  // 1. Memory. This app builds with --max-old-space-size=1024 and needs a 2 GB
  //    swapfile on a t3.small. Running ESLint's AST analysis inside `next build`
  //    adds heap pressure to a step that already sits near the ceiling. A build
  //    that OOMs at 90% is worse than a lint finding.
  //
  // 2. Separation of concerns. A build should produce an artifact; a gate should
  //    decide whether the artifact is allowed. Coupling them means a lint
  //    warning can fail a production build, and it means you cannot build an
  //    older commit to roll back if that commit has since-added lint rules
  //    failing against it.
  //
  // Type errors are NOT ignored — `typescript.ignoreBuildErrors` stays false, so
  // `next build` still fails on a type error. That is intentional: a type error
  // means the artifact is genuinely broken, whereas a lint warning means it is
  // untidy.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
