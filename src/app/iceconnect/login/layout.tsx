import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Enter workspace | ICECONNECT",
  description: "ICECONNECT — your company’s execution engine. Sign in to operate teams and close faster.",
};

export default function IceconnectLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
