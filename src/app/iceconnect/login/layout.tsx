import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Enter workspace | ICECONNECT",
  description:
    "ICECONNECT — your business operating system. Execute with Nexa. Build, close, and grow in one workspace.",
};

export default function IceconnectLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
