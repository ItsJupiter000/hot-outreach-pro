import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["nodemailer", "imapflow", "node-cron"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
