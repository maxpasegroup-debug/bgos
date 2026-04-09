"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type BgosTheme = "dark" | "light";

type Ctx = {
  theme: BgosTheme;
  setTheme: (t: BgosTheme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "bgos-ui-theme";

const BgosThemCtx = createContext<Ctx | null>(null);

function readStoredTheme(): BgosTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function BgosThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BgosTheme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) setThemeState(stored);
    setHydrated(true);
  }, []);

  const setTheme = useCallback((t: BgosTheme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: BgosTheme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <BgosThemCtx.Provider value={value}>
      <div
        className={
          theme === "light"
            ? "min-h-screen bg-[#F4F6FA] text-slate-900 antialiased transition-colors duration-300"
            : "min-h-screen bg-[#0B0F14] text-white antialiased transition-colors duration-300"
        }
        data-bgos-theme={theme}
        data-bgos-theme-hydrated={hydrated ? "1" : "0"}
        suppressHydrationWarning
      >
        {children}
      </div>
    </BgosThemCtx.Provider>
  );
}

export function useBgosTheme(): Ctx {
  const c = useContext(BgosThemCtx);
  if (!c) throw new Error("useBgosTheme must be used under BgosThemeProvider");
  return c;
}
