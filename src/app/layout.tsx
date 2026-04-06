import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { BGOSLayout } from "@/components/layout-shells/BGOSLayout";
import { IceconnectLayout } from "@/components/layout-shells/IceconnectLayout";
import { isIceconnectInHost } from "@/lib/host-routing";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";
  if (isIceconnectInHost(host)) {
    return {
      title: "ICECONNECT",
      description: "ICECONNECT — field and operations workspace.",
    };
  }
  return {
    title: "BGOS — Business Growth Operating System",
    description:
      "BGOS automates, manages, and grows your business — while you focus on what truly matters.",
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden">
        <DomainShell>{children}</DomainShell>
      </body>
    </html>
  );
}
