import { IceconnectMobileShell } from "@/components/iceconnect/IceconnectMobileShell";

export default function SdeLayout({ children }: { children: React.ReactNode }) {
  return (
    <IceconnectMobileShell title="SDE Workspace" basePath="/iceconnect/sde">
      {children}
    </IceconnectMobileShell>
  );
}
