import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InternalLayout } from "@/components/internal/InternalLayout";
import { InternalThemeProvider } from "@/components/internal/InternalThemeProvider";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { isSuperBossEmail } from "@/lib/super-boss";

export const metadata: Metadata = {
  title: "BGOS Internal | Platform",
  description: "BGOS internal sales, tech, and platform control.",
};

export default async function InternalRootLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/login?from=/internal/control");
  }
  const platform =
    (user.superBoss === true && isSuperBossEmail(user.email)) || user.isInternal === true;
  if (!platform) {
    redirect("/bgos/boss/home");
  }

  return (
    <InternalThemeProvider>
      <InternalLayout>{children}</InternalLayout>
    </InternalThemeProvider>
  );
}
