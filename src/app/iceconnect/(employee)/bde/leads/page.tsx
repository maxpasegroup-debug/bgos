"use client";

import { useMemo, useState } from "react";

type Lead = { id: string; name: string; phone: string; status: string };

const DATA: Lead[] = [
  { id: "1", name: "Ananya Sharma", phone: "+91 98765 43210", status: "Hot" },
  { id: "2", name: "Vikram Patel", phone: "+91 91234 56780", status: "Follow up" },
  { id: "3", name: "Neha Kapoor", phone: "+91 99887 76655", status: "New" },
  { id: "4", name: "Rahul Verma", phone: "+91 90000 11122", status: "Closed" },
];

export default function BdeLeadsPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string | "all">("all");

  const rows = useMemo(() => {
    let r = DATA;
    if (filter !== "all") r = r.filter((x) => x.status === filter);
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(s) || x.phone.includes(s));
    }
    return r;
  }, [q, filter]);

  const glass: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 10,
  };

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or phone"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.05)",
          color: "white",
          marginBottom: 12,
          fontSize: 14,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(["all", "Hot", "New", "Follow up", "Closed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f === "all" ? "all" : f)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              border:
                (f === "all" && filter === "all") || f === filter
                  ? "1px solid rgba(79,209,255,0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
              background:
                (f === "all" && filter === "all") || f === filter
                  ? "rgba(79,209,255,0.12)"
                  : "transparent",
              color: "white",
              cursor: "pointer",
            }}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>
      {rows.map((L) => (
        <div key={L.id} style={glass}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{L.name}</p>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{L.status}</span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "6px 0 10px" }}>{L.phone}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`tel:${L.phone}`} style={btn("#38BDF8")}>
              Call
            </a>
            <a
              href={`https://wa.me/${L.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              style={btn("#34D399")}
            >
              WhatsApp
            </a>
            <button type="button" style={btn("#F87171")} onClick={() => alert("Mark closed — wire PATCH")}>
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${color}44`,
    background: `${color}14`,
    color,
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "inherit",
  };
}
