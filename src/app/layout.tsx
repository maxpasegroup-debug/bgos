import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BGOSLayout } from "@/components/layout-shells/BGOSLayout";
import { IceconnectLayout } from "@/components/layout-shells/IceconnectLayout";
import { isIceconnectInHost } from "@/lib/host-routing";
import "./globals.css";

/**
 * Viewport — controls theme-color, full-screen viewport fit, and prevents
 * double-tap zoom on mobile (standard for PWA-like experiences).
 */
export const viewport: Viewport = {
  width:          "device-width",
  initialScale:   1,
  maximumScale:   1,
  themeColor:     "#070A0E",
  viewportFit:    "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  if (isIceconnectInHost(host)) {
    return {
      title: "ICECONNECT",
      description: "ICECONNECT — field and operations workspace.",
      appleWebApp: {
        capable:         true,
        title:           "ICECONNECT",
        statusBarStyle:  "black-translucent",
      },
    };
  }
  return {
    title:       "BGOS — Business Growth Operating System",
    description: "BGOS automates, manages, and grows your business — while you focus on what truly matters.",
    appleWebApp: {
      capable:        true,
      title:          "BGOS",
      statusBarStyle: "black-translucent",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const DomainShell = isIceconnectInHost(host) ? IceconnectLayout : BGOSLayout;

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <DomainShell>{children}</DomainShell>
        <div id="modal-root" />
      </body>
    </html>
  );
}
