import type { NextConfig } from "next";

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "https://qutaibiv.com,https://www.qutaibiv.com"
).split(",");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Keep BUILD-TIME tooling (wrangler/workerd/esbuild/swc/native engines) out of
  // the traced standalone output — they bloat the Workers bundle beyond limits.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/wrangler/**",
      "node_modules/workerd/**",
      "node_modules/@cloudflare/workerd-*/**",
      "node_modules/miniflare/**",
      "node_modules/esbuild/**",
      "node_modules/@esbuild/**",
      "node_modules/@next/swc*/**",
      "node_modules/@swc/**",
      "node_modules/@napi-rs/**",
      "node_modules/@prisma/engines/**",
      "node_modules/prisma/**",
      "node_modules/rclone.js/**",
      "node_modules/blake3-wasm/**",
    ],
  },
  // Native/Node-heavy libs must stay external so their worker files load correctly
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // API: allow same-origin + explicitly configured origins only
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: ALLOWED_ORIGINS.join(", "),
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
