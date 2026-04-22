import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@next/font"],
  },
  /** Expose ICECONNECT_URL to the client bundle for same-origin login handoff (Railway often sets server-only `ICECONNECT_URL`). */
  env: {
    NEXT_PUBLIC_ICECONNECT_URL:
      process.env.NEXT_PUBLIC_ICECONNECT_URL?.trim() ||
      process.env.ICECONNECT_URL?.trim() ||
      "",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      /**
       * Avoid serving stale HTML from CDNs/browser after a deploy — mismatched HTML vs
       * `/_next/static` chunks causes “Failed to find Server Action” until a hard refresh.
       */
      {
        source: "/onboarding/nexa",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/login",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
