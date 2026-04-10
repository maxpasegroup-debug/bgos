"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "bgos-theme";

export type BgosTheme = "dark" | "light";

type Ctx = {
  theme: BgosTheme;
  setTheme: (t: BgosTheme) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const BgosThemeContext = createContext<Ctx | null>(null);

function readStoredTheme(): BgosTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function BgosThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BgosTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setMounted(true);
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
    () => ({ theme, setTheme, toggleTheme, mounted }),
    [theme, setTheme, toggleTheme, mounted],
  );

  return <BgosThemeContext.Provider value={value}>{children}</BgosThemeContext.Provider>;
}

export function useBgosTheme(): Ctx {
  const ctx = useContext(BgosThemeContext);
  if (!ctx) {
    throw new Error("useBgosTheme must be used within BgosThemeProvider");
  }
  return ctx;
}
