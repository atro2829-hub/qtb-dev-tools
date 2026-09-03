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
  // Native/Node-heavy libs must stay external so their worker files load correctly
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "docx", "mammoth"],
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
