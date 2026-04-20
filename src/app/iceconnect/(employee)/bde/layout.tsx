import { IceconnectMobileShell } from "@/components/iceconnect/IceconnectMobileShell";

export default function BdeLayout({ children }: { children: React.ReactNode }) {
  return (
    <IceconnectMobileShell title="BDE Workspace" basePath="/iceconnect/bde">
      {children}
    </IceconnectMobileShell>
  );
}
