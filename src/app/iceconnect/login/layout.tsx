import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in | ICECONNECT",
  description: "ICECONNECT — sign in to your work dashboard.",
};

export default function IceconnectLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
