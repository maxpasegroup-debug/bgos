import { IceconnectMobileShell } from "@/components/iceconnect/IceconnectMobileShell";

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <IceconnectMobileShell title="Nexa Onboard" basePath="/iceconnect/bde">
      {children}
    </IceconnectMobileShell>
  );
}
