import type { MetadataRoute } from "next";

/**
 * Web App Manifest — enables "Add to Home Screen" + standalone full-screen mode.
 * Served at /manifest.webmanifest by Next.js App Router.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BGOS — Business Growth OS",
    short_name: "BGOS",
    description: "Business Growth Operating System — leads, team, earnings, all in one app.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#070A0E",
    theme_color: "#070A0E",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        purpose: "any" as any,
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        purpose: "any" as any,
      },
    ],
  };
}
