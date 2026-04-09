"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PortalData = {
  customer: { id: string; name: string; phone: string; source?: string | null };
  installation: { status: string; completedAt: string | null } | null;
  loan: { status: string; loanAmount: number; notes?: string | null } | null;
  documents: { id: string; fileName: string; type: string; createdAt: string; downloadUrl: string }[];
  services: { id: string; title: string; status: string; createdAt: string; resolvedAt: string | null }[];
  complaints: { id: string; description: string; status: string; createdAt: string }[];
};

export default function IceconnectCustomerPortalPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/overview", { credentials: "include" });
      const j = (await res.json()) as { data?: PortalData; message?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) router.replace("/iceconnect/customer-login");
        setError(j.message ?? j.error ?? "Could not load your details.");
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as PortalData));
      }
    } catch {
      setError("Could not load your details.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function logout() {
    await fetch("/api/customer/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/iceconnect/customer-login");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Account</h1>
          <p className="text-sm text-white/65">Your installation and service updates</p>
        </div>
        <button onClick={() => void logout()} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/85">Logout</button>
      </div>

      {loading ? <p className="text-sm text-white/65">Loading...</p> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {!data ? null : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Customer">
            <p className="text-sm text-white">{data.customer.name}</p>
            <p className="text-xs text-white/75">{data.customer.phone}</p>
          </Card>
          <Card title="Installation Status">
            <p className="text-sm text-white/85">{data.installation?.status ?? "Not started"}</p>
          </Card>
          <Card title="Loan Status">
            <p className="text-sm text-white/85">{data.loan?.status ?? "No loan"}</p>
          </Card>
          <Card title="Documents">
            <div className="space-y-1">
              {data.documents.map((d) => (
                <a key={d.id} href={d.downloadUrl} className="block text-xs text-[#FFC300] hover:underline">{d.fileName}</a>
              ))}
            </div>
          </Card>
          <Card title="Service Requests">
            <div className="space-y-1">
              {data.services.map((s) => (
                <p key={s.id} className="text-xs text-white/80">{s.title} · {s.status}</p>
              ))}
            </div>
          </Card>
          <Card title="Complaints">
            <div className="space-y-1">
              {data.complaints.map((c) => (
                <p key={c.id} className="text-xs text-white/80">{c.description} · {c.status}</p>
              ))}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
