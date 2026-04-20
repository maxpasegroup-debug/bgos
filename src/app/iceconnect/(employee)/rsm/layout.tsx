import { IceconnectMobileShell } from "@/components/iceconnect/IceconnectMobileShell";

export default function RsmLayout({ children }: { children: React.ReactNode }) {
  return (
    <IceconnectMobileShell title="RSM Control" basePath="/iceconnect/rsm">
      {children}
    </IceconnectMobileShell>
  );
}
