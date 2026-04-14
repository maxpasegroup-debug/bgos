"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

type Filter = "all" | "active" | "pending_service";
type Overview = {
  totalCustomers: number;
  activeCustomers: number;
  pendingServiceRequests: number;
  complaints: number;
};
type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  location: string;
  status: "Active" | "Service Pending";
  pendingServiceCount: number;
};
type Detail = {
  customer: { id: string; name: string; phone: string; address: string };
  installation: { status: string; completedAt: string | null } | null;
  loan: { status: string; loanAmount: number; notes?: string | null } | null;
  documents: { id: string; fileName: string; type: string; createdAt: string; downloadUrl: string }[];
  services: { id: string; issue: string; status: string; createdAt: string }[];
  complaints: { id: string; description: string; status: string; createdAt: string }[];
};
type Payload = {
  overview: Overview;
  customers: CustomerRow[];
  detail: Detail | null;
  insights: { insights: string[]; suggestions: string[] };
};

function fDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function BgosCustomerCommandCenter() {
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", location: "", password: "" });
  const [serviceForm, setServiceForm] = useState({
    leadId: "",
    issue: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
  });
  const [complaintText, setComplaintText] = useState("");
  const [nexaLine, setNexaLine] = useState<string | null>(null);

  const load = useCallback(async (leadId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/bgos/customer?filter=${encodeURIComponent(filter)}${leadId ? `&leadId=${encodeURIComponent(leadId)}` : ""}`;
      const res = await apiFetch(url);
      const j = (await res.json()) as { data?: Payload; message?: string; error?: string };
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Could not load customers.");
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as Payload));
      }
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach customer API"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load(selectedId ?? undefined);
  }, [load, selectedId]);

  const selected = useMemo(() => data?.detail ?? null, [data?.detail]);

  async function createCustomer() {
    await apiFetch("/api/bgos/customer/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        password: form.password.trim() || undefined,
      }),
    });
    setForm({ name: "", phone: "", location: "", password: "" });
    setAddOpen(false);
    await load(selectedId ?? undefined);
  }

  async function createService(leadId?: string) {
    const targetLeadId = serviceForm.leadId || leadId || selectedId || "";
    if (!targetLeadId) return;
    await apiFetch("/api/bgos/customer/service", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: targetLeadId,
        issue: serviceForm.issue.trim(),
        priority: serviceForm.priority,
      }),
    });
    setServiceForm({ leadId: "", issue: "", priority: "MEDIUM" });
    setServiceOpen(false);
    await load(targetLeadId);
  }

  async function addComplaint() {
    if (!selectedId || !complaintText.trim()) return;
    await apiFetch("/api/bgos/customer/complaint", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: selectedId, description: complaintText.trim() }),
    });
    setComplaintText("");
    await load(selectedId);
  }

  async function resolveComplaint(id: string) {
    await apiFetch("/api/bgos/customer/complaint", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "RESOLVED" }),
    });
    await load(selectedId ?? undefined);
  }

  async function uploadDocument(file: File) {
    if (!selectedId) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", "OTHER");
    fd.set("leadId", selectedId);
    await apiFetch("/api/document/upload", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    await load(selectedId);
  }

  return (
    <div className={`${BGOS_MAIN_PAD} pb-12 pt-6`}>
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Customers</h1>
              <p className="text-sm text-white/65">Manage your customers and relationships</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setAddOpen(true)} className="rounded-xl bg-[#FFC300] px-3 py-2 text-sm font-semibold text-black">Add Customer</button>
              <button onClick={() => setServiceOpen(true)} className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/90">Create Service Request</button>
              {([
                ["all", "All"],
                ["active", "Active"],
                ["pending_service", "Pending Service"],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs ${filter === key ? "bg-white text-black" : "bg-white/[0.06] text-white/75"}`}>{label}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total customers" value={data?.overview.totalCustomers ?? 0} />
          <Metric label="Active customers" value={data?.overview.activeCustomers ?? 0} />
          <Metric label="Pending service requests" value={data?.overview.pendingServiceRequests ?? 0} />
          <Metric label="Complaints" value={data?.overview.complaints ?? 0} highlight="text-amber-300" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">Customer List</h2>
            {loading ? <p className="mt-4 text-sm text-white/60">Loading customers...</p> : null}
            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
            {!loading && !error && (data?.customers.length ?? 0) === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/70">
                <p>No customers yet</p>
                <button onClick={() => setAddOpen(true)} className="mt-3 rounded-lg bg-[#FFC300] px-3 py-2 text-xs font-semibold text-black">Add your first customer</button>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {(data?.customers ?? []).map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === c.id ? "border-[#FFC300]/60 bg-[#FFC300]/10" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    <p className={`text-xs ${c.status === "Service Pending" ? "text-amber-300" : "text-emerald-300"}`}>{c.status}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/70">{c.phone}</p>
                  <p className="text-xs text-white/55">{c.location || "—"}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">Customer Detail</h2>
            {!selected ? <p className="mt-4 text-sm text-white/60">Select a customer to view details.</p> : (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-base font-semibold text-white">{selected.customer.name}</p>
                  <p className="text-xs text-white/70">{selected.customer.phone}</p>
                  <p className="text-xs text-white/55">{selected.customer.address || "—"}</p>
                </div>
                <Card title="Installation Status">
                  <p className="text-sm text-white/85">{selected.installation?.status ?? "Not started"}</p>
                </Card>
                <Card title="Loan Status">
                  <p className="text-sm text-white/85">{selected.loan?.status ?? "No loan"}</p>
                </Card>
                <Card title="Documents">
                  <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDocument(f); }} className="text-xs text-white/80" />
                  <div className="mt-2 space-y-1">
                    {selected.documents.map((d) => (
                      <a key={d.id} href={d.downloadUrl} className="block text-xs text-[#FFC300] hover:underline">{d.fileName}</a>
                    ))}
                  </div>
                </Card>
                <Card title="Service History">
                  <button onClick={() => setServiceOpen(true)} className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/85">Create service request</button>
                  <div className="mt-2 space-y-1">
                    {selected.services.map((s) => <p key={s.id} className="text-xs text-white/75">{s.issue} · {s.status}</p>)}
                  </div>
                </Card>
                <Card title="Complaints">
                  <textarea value={complaintText} onChange={(e) => setComplaintText(e.target.value)} placeholder="Complaint description" className="h-20 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-white" />
                  <button onClick={() => void addComplaint()} className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-xs text-white">Add complaint</button>
                  <div className="mt-2 space-y-1">
                    {selected.complaints.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs text-white/75">
                        <span>{c.description}</span>
                        {c.status === "PENDING" ? <button onClick={() => void resolveComplaint(c.id)} className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-200">Resolve</button> : <span className="text-emerald-300">Resolved</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">Nexa Customer Insights</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Card title="Insights">{(data?.insights.insights ?? []).map((x) => <p key={x} className="text-sm text-white/80">{x}</p>)}</Card>
            <Card title="Suggestions">{(data?.insights.suggestions ?? []).map((x) => <p key={x} className="text-sm text-white/80">{x}</p>)}</Card>
            <Card title="Actions">
              <button onClick={() => setNexaLine("We are prioritizing pending services first.")} className="rounded-lg bg-[#FFC300] px-3 py-2 text-xs font-semibold text-black">Fix Now</button>
              {nexaLine ? <p className="mt-2 text-xs text-[#FFC300]/90">{nexaLine}</p> : null}
            </Card>
          </div>
        </section>

        {addOpen ? (
          <Modal onClose={() => setAddOpen(false)} title="Add Customer">
            <Input label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
            <Input label="Location" value={form.location} onChange={(v) => setForm((s) => ({ ...s, location: v }))} />
            <Input label="Customer portal password (optional)" type="password" value={form.password} onChange={(v) => setForm((s) => ({ ...s, password: v }))} />
            <button onClick={() => void createCustomer()} className="mt-3 rounded-lg bg-[#FFC300] px-3 py-2 text-sm font-semibold text-black">Create customer</button>
          </Modal>
        ) : null}

        {serviceOpen ? (
          <Modal onClose={() => setServiceOpen(false)} title="Create Service Request">
            <label className="text-xs text-white/65">Customer</label>
            <select value={serviceForm.leadId} onChange={(e) => setServiceForm((s) => ({ ...s, leadId: e.target.value }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white">
              <option value="">Select customer</option>
              {(data?.customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input label="Issue" value={serviceForm.issue} onChange={(v) => setServiceForm((s) => ({ ...s, issue: v }))} />
            <label className="mt-2 block text-xs text-white/65">Priority</label>
            <select value={serviceForm.priority} onChange={(e) => setServiceForm((s) => ({ ...s, priority: e.target.value as "LOW" | "MEDIUM" | "HIGH" }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            <button onClick={() => void createService()} className="mt-3 rounded-lg bg-[#FFC300] px-3 py-2 text-sm font-semibold text-black">Create</button>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-wide text-white/55">{label}</p>
      <p className={`mt-1 text-lg font-semibold text-white ${highlight ?? ""}`}>{value.toLocaleString("en-IN")}</p>
    </motion.div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/55 p-4">
      <div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-white/12 bg-[#0b0f1a] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button onClick={onClose} className="text-xs text-white/65">Close</button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="mt-2 block">
      <span className="text-xs text-white/65">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white" />
    </label>
  );
}
