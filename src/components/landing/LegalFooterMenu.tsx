"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const items = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Refund Policy", href: "/legal/refund-policy" },
  { label: "Terms & Conditions", href: "/legal/terms-and-conditions" },
] as const;

export function LegalFooterMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const btn =
    "rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10";

  const panel =
    "absolute right-0 z-50 mt-2 min-w-[220px] rounded-xl border border-white/10 bg-[#121821] py-1 shadow-xl";

  const link = "block px-4 py-2.5 text-sm text-white/85 hover:bg-white/5";

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={btn} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Legal
        <span className="ml-1 text-xs opacity-70">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className={panel} role="menu">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className={link} role="menuitem" onClick={() => setOpen(false)}>
              {it.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
