"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type CompanyBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  billingAddress?: string | null;
  gstNumber?: string | null;
};

const STORAGE_KEY = "bgos_iceconnect_company_brand_v1";

export const DEFAULT_PRIMARY = "#ef4444";
export const DEFAULT_SECONDARY = "#facc15";

type CompanyBrandingContextValue = {
  company: CompanyBranding | null;
  ready: boolean;
  refresh: () => Promise<void>;
  primaryColor: string;
  secondaryColor: string;
};

const CompanyBrandingContext = createContext<CompanyBrandingContextValue | null>(null);

function readStoredBrand(): CompanyBranding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    if (typeof o.name !== "string") return null;
    return {
      name: o.name,
      logoUrl: typeof o.logoUrl === "string" ? o.logoUrl : null,
      primaryColor: typeof o.primaryColor === "string" ? o.primaryColor : null,
      secondaryColor: typeof o.secondaryColor === "string" ? o.secondaryColor : null,
      ...(typeof o.companyEmail === "string" ? { companyEmail: o.companyEmail } : {}),
      ...(typeof o.companyPhone === "string" ? { companyPhone: o.companyPhone } : {}),
      ...(typeof o.billingAddress === "string" ? { billingAddress: o.billingAddress } : {}),
      ...(typeof o.gstNumber === "string" ? { gstNumber: o.gstNumber } : {}),
    };
  } catch {
    return null;
  }
}

export function writeStoredCompanyBrand(company: CompanyBranding): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(company));
  } catch {
    /* ignore */
  }
}

export function clearStoredCompanyBrand(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function CompanyBrandingProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyBranding | null>(() => readStoredBrand());
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/company/current", { credentials: "include" });
      if (!res.ok) {
        setReady(true);
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        company?: CompanyBranding;
      };
      if (data.ok === true && data.company && typeof data.company.name === "string") {
        setCompany(data.company);
        writeStoredCompanyBrand(data.company);
      }
    } catch {
      /* keep cache */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const primaryColor = company?.primaryColor?.trim() || DEFAULT_PRIMARY;
  const secondaryColor = company?.secondaryColor?.trim() || DEFAULT_SECONDARY;

  const value = useMemo(
    () => ({
      company,
      ready,
      refresh,
      primaryColor,
      secondaryColor,
    }),
    [company, ready, refresh, primaryColor, secondaryColor],
  );

  const style = useMemo(
    () =>
      ({
        "--ice-primary": primaryColor,
        "--ice-secondary": secondaryColor,
      }) as CSSProperties,
    [primaryColor, secondaryColor],
  );

  return (
    <CompanyBrandingContext.Provider value={value}>
      <div className="iceconnect-brand-root min-h-screen" style={style}>
        {children}
      </div>
    </CompanyBrandingContext.Provider>
  );
}

export function useCompanyBranding(): CompanyBrandingContextValue {
  const ctx = useContext(CompanyBrandingContext);
  if (!ctx) {
    throw new Error("useCompanyBranding must be used within CompanyBrandingProvider");
  }
  return ctx;
}
