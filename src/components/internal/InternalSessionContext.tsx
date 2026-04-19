"use client";

import { createContext, useContext } from "react";
import type { SalesNetworkRole } from "@prisma/client";

export type InternalSession = {
  userId: string;
  email: string;
  salesNetworkRole: SalesNetworkRole;
  roleLabel: string;
};

const InternalSessionContext = createContext<InternalSession | null>(null);

export function InternalSessionProvider({
  session,
  children,
}: {
  session: InternalSession;
  children: React.ReactNode;
}) {
  return (
    <InternalSessionContext.Provider value={session}>
      {children}
    </InternalSessionContext.Provider>
  );
}

export function useInternalSession(): InternalSession {
  const ctx = useContext(InternalSessionContext);
  if (!ctx) throw new Error("useInternalSession must be used inside InternalSessionProvider");
  return ctx;
}
