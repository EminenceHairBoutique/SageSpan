import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.join(__dirname, "../../");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@sagespan/contracts"],
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: { "/api/samples/[name]": ["../../fixtures/synthetic/imports/**"] },
  turbopack: { root: monorepoRoot },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
