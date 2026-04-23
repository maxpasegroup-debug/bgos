import { IceconnectMobileShell } from "@/components/iceconnect/IceconnectMobileShell";

export default function BdmLayout({ children }: { children: React.ReactNode }) {
  return (
    <IceconnectMobileShell title="Franchise Dashboard" basePath="/iceconnect/bdm">
      {children}
    </IceconnectMobileShell>
  );
}
