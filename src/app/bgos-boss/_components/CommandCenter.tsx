"use client";

import { useState } from "react";

type ActiveForm = "announcement" | "campaign" | "competition" | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandCenter() {
  const [active, setActive] = useState<ActiveForm>(null);

  function toggle(form: ActiveForm) {
    setActive((prev) => (prev === form ? null : form));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Action cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <ActionCard
          icon="📢"
          label="Announcement"
          description="Broadcast to all staff"
          active={active === "announcement"}
          accent="#4FD1FF"
          onClick={() => toggle("announcement")}
        />
        <ActionCard
          icon="🚀"
          label="Campaign"
          description="Activate performance push"
          active={active === "campaign"}
          accent="#7C5CFF"
          onClick={() => toggle("campaign")}
        />
        <ActionCard
          icon="🏆"
          label="Competition"
          description="Start a new contest"
          active={active === "competition"}
          accent="#F59E0B"
          onClick={() => toggle("competition")}
        />
      </div>

      {/* Inline forms */}
      {active === "announcement" && (
        <InlineForm
          title="Send Announcement"
          onClose={() => setActive(null)}
          onSubmit={(data) => {
            console.log("announcement →", data);
            alert(`Announcement queued: "${data.title}"\n\nConnect to POST /api/nexa/announcements`);
            setActive(null);
          }}
          fields={[
            { key: "title",   label: "Title",   type: "text",     placeholder: "e.g. Q2 push starts today" },
            { key: "message", label: "Message", type: "textarea", placeholder: "Write your announcement..." },
          ]}
          submitLabel="Send to All Staff"
          accent="#4FD1FF"
        />
      )}

      {active === "campaign" && (
        <InlineForm
          title="Launch Campaign"
          onClose={() => setActive(null)}
          onSubmit={(data) => {
            console.log("campaign →", data);
            alert(`Campaign queued: "${data.title}"\n\nConnect to POST /api/bgos/control/performance-engine`);
            setActive(null);
          }}
          fields={[
            { key: "title",  label: "Campaign Name",  type: "text", placeholder: "e.g. July Blitz" },
            { key: "target", label: "Target (₹ / pts)", type: "text", placeholder: "e.g. 50000" },
            { key: "ends",   label: "End Date",        type: "date", placeholder: "" },
          ]}
          submitLabel="Launch Campaign"
          accent="#7C5CFF"
        />
      )}

      {active === "competition" && (
        <InlineForm
          title="Start Competition"
          onClose={() => setActive(null)}
          onSubmit={(data) => {
            console.log("competition →", data);
            alert(`Competition queued: "${data.title}"\n\nConnect to POST /api/internal/rewards/competitions`);
            setActive(null);
          }}
          fields={[
            { key: "title",       label: "Competition Name", type: "text", placeholder: "e.g. Top BDE of the Month" },
            { key: "target",      label: "Target (pts)",     type: "text", placeholder: "e.g. 20"  },
            { key: "reward",      label: "Reward (₹)",       type: "text", placeholder: "e.g. 5000" },
            { key: "ends",        label: "End Date",         type: "date", placeholder: ""          },
          ]}
          submitLabel="Start Competition"
          accent="#F59E0B"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionCard
// ---------------------------------------------------------------------------

function ActionCard({
  icon, label, description, active, accent, onClick,
}: {
  icon: string; label: string; description: string;
  active: boolean; accent: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "16px",
        borderRadius: 14,
        background: active ? `${accent}12` : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? `${accent}35` : "rgba(255,255,255,0.07)"}`,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "border-color 0.15s, background 0.15s",
        width: "100%",
      }}
    >
      <p style={{ fontSize: 22, margin: "0 0 8px" }}>{icon}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: active ? accent : "rgba(255,255,255,0.8)", margin: "0 0 3px" }}>
        {label}
      </p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>
        {description}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// InlineForm (shared)
// ---------------------------------------------------------------------------

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date";
  placeholder: string;
};

function InlineForm({
  title, onClose, onSubmit, fields, submitLabel, accent,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => void;
  fields: FieldDef[];
  submitLabel: string;
  accent: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );

  function set(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        padding: "20px 22px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${accent}20`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>
          {title}
        </p>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.3)",
            fontSize: 18, cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>

      {/* Fields */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, display: "block", marginBottom: 6, letterSpacing: "0.06em" }}>
              {f.label.toUpperCase()}
            </label>
            {f.type === "textarea" ? (
              <textarea
                rows={3}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                style={{ ...inputBase, resize: "vertical" }}
              />
            ) : (
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                style={inputBase}
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onSubmit(values)}
          style={{
            padding: "9px 20px",
            borderRadius: 10,
            background: `${accent}20`,
            border: `1px solid ${accent}35`,
            color: accent,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
