"use client";

import { useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrainingControl() {
  const [title, setTitle]     = useState("");
  const [file, setFile]       = useState<File | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setSaved(false);
  }

  async function handleSave() {
    if (!title.trim() || !file) return;
    setSaving(true);

    // TODO: POST /api/internal/training with FormData
    // const fd = new FormData();
    // fd.append("title", title.trim());
    // fd.append("file", file);
    // await fetch("/api/internal/training", { method: "POST", body: fd });

    // Placeholder — simulate save delay
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTitle("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const canSave = title.trim().length > 0 && file !== null && !saving;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Title field */}
      <div>
        <label style={labelStyle}>TITLE</label>
        <input
          type="text"
          placeholder="e.g. BDE Objection Handling Guide"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          style={inputStyle}
        />
      </div>

      {/* File drop zone */}
      <div>
        <label style={labelStyle}>FILE (PDF or VIDEO)</label>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%",
            padding: "24px 16px",
            borderRadius: 12,
            border: `1.5px dashed ${file ? "rgba(79,209,255,0.35)" : "rgba(255,255,255,0.12)"}`,
            background: file ? "rgba(79,209,255,0.04)" : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "center" as const,
            transition: "border-color 0.15s",
          }}
        >
          {file ? (
            <div>
              <p style={{ fontSize: 13, color: "#4FD1FF", fontWeight: 600, margin: "0 0 2px" }}>
                {file.name}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 2px" }}>
                Click to select file
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0 }}>
                PDF or MP4 · max 200 MB
              </p>
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.mp4,.mov,.webm"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!canSave}
        style={{
          padding: "11px 20px",
          borderRadius: 12,
          background: canSave ? "rgba(79,209,255,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${canSave ? "rgba(79,209,255,0.3)" : "rgba(255,255,255,0.07)"}`,
          color: canSave ? "#4FD1FF" : "rgba(255,255,255,0.2)",
          fontSize: 13,
          fontWeight: 700,
          cursor: canSave ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          transition: "all 0.15s",
        }}
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save Training Material"}
      </button>

      {saved && (
        <p style={{ fontSize: 12, color: "#34D399", margin: 0 }}>
          Material saved — visible to BDE and Micro Franchise Partner roles on /internal/training
        </p>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.28)",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 11,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
