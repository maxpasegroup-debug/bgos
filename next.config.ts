import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
