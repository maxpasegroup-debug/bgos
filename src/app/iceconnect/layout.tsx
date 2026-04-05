import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ICECONNECT",
  description: "ICECONNECT — field and operations workspace.",
};

export default function IceconnectRootLayout({ children }: { children: ReactNode }) {
  return children;
}
