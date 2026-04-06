import type { ReactNode } from "react";

/**
 * Root UI shell for the ICECONNECT domain only — no BGOS chrome.
 * Workspace nav lives in `app/iceconnect/(workspace)/layout.tsx`.
 */
export function IceconnectLayout({ children }: { children: ReactNode }) {
  return (
    <div
      id="iceconnect-domain-root"
      className="flex min-h-screen flex-1 flex-col bg-[#F8FAFC] text-slate-900 antialiased"
    >
      {children}
    </div>
  );
}
