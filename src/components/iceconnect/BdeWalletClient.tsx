"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type WalletPayload = {
  wallet: { total_earned: number; withdrawable: number; bonus: number };
  activity: Array<{ id: string; label: string; display: string; created_at: string }>;
  money_message: string;
  messages: string[];
};

function fmtInr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function BdeWalletClient() {
  const [data, setData] = useState<WalletPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/bde/wallet", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<WalletPayload>;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load wallet");
        return;
      }
      setData({
        wallet: j.wallet!,
        activity: j.activity ?? [],
        money_message: j.money_message ?? "",
        messages: j.messages ?? [],
      });
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitWithdraw(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseFloat(withdrawAmt);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/bde/wallet/withdraw", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_inr: n }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Withdrawal failed");
        return;
      }
      setWithdrawAmt("");
      await load();
    } catch (e) {
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }

  const glass: React.CSSProperties = {
    padding: "18px 20px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  };

  if (err && !data) {
    return <p style={{ color: "#f87171", fontSize: 14 }}>{err}</p>;
  }
  if (!data) {
    return <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Loading wallet…</p>;
  }

  return (
    <div>
      {err ? <p style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{err}</p> : null}

      <div
        style={{
          ...glass,
          background: "linear-gradient(145deg, rgba(79,209,255,0.08), rgba(124,92,255,0.06))",
          borderColor: "rgba(79,209,255,0.2)",
        }}
      >
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 6px" }}>{data.money_message}</p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 6px" }}>Total earned</p>
        <p style={{ fontSize: 32, fontWeight: 800, margin: "0 0 18px", color: "#4FD1FF" }}>{fmtInr(data.wallet.total_earned)}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Withdrawable</p>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{fmtInr(data.wallet.withdrawable)}</p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Bonus</p>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{fmtInr(data.wallet.bonus)}</p>
          </div>
        </div>
      </div>

      <form onSubmit={submitWithdraw} style={glass}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", margin: "0 0 10px" }}>
          WITHDRAW
        </p>
        <input
          type="number"
          min={1}
          step={1}
          placeholder="Amount (INR)"
          value={withdrawAmt}
          onChange={(e) => setWithdrawAmt(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.2)",
            color: "white",
            fontSize: 16,
            marginBottom: 10,
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            border: "none",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            background: "linear-gradient(135deg, rgba(52,211,153,0.35), rgba(79,209,255,0.35))",
            color: "white",
          }}
        >
          Request withdrawal
        </button>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "10px 0 0", lineHeight: 1.4 }}>
          Earnings are credited only when conversions are confirmed in the system. Withdrawals are reviewed by ops.
        </p>
      </form>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", margin: "0 0 10px" }}>
        RECENT ACTIVITY
      </p>
      {data.activity.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No transactions yet.</p>
      ) : (
        data.activity.map((a) => (
          <div key={a.id} style={glass}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>{a.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#34D399" }}>{a.display}</span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "6px 0 0" }}>
              {new Date(a.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
