import type { ReactNode } from "react";

/**
 * Root UI shell for the BGOS domain only — no ICECONNECT chrome.
 * Navigation stays in `app/bgos` (BgosAppChrome); this is domain-level chrome only.
 */
export function BGOSLayout({ children }: { children: ReactNode }) {
  return (
    <div
      id="bgos-domain-root"
      className="flex min-h-screen flex-1 flex-col bg-[#0B0F19] text-white antialiased"
    >
      {children}
    </div>
  );
}
