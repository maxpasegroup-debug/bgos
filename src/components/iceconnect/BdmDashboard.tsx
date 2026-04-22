"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
import { BdmClients } from "./bdm/BdmClients";
import { BdmLeads } from "./bdm/BdmLeads";
import { BdmOnboarding } from "./bdm/BdmOnboarding";
import { BdmOverview } from "./bdm/BdmOverview";
import { BdmTechRequests } from "./bdm/BdmTechRequests";
import { ChangePasswordModal } from "./ChangePasswordModal";

type TabKey = "overview" | "leads" | "onboarding" | "clients" | "tech";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "leads", label: "My Leads" },
  { key: "onboarding", label: "Onboarding" },
  { key: "clients", label: "Clients" },
  { key: "tech", label: "Tech Requests" },
];

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
};

export function BdmDashboard({ user }: { user: AuthUser }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [changePwOpen, setChangePwOpen] = useState(false);

  async function loadNotifications() {
    try {
      const res = await apiFetch("/api/bdm/notifications", { credentials: "include" });
      const body = (await res.json()) as { unreadCount?: number; notifications?: NotificationRow[] };
      if (!res.ok) return;
      setUnreadCount(body.unreadCount ?? 0);
      setNotifications(Array.isArray(body.notifications) ? body.notifications : []);
    } catch {
      // Ignore transient polling failures.
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/bdm/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } finally {
      setUnreadCount(0);
      setNotifications([]);
      setNotificationsOpen(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const tabContent = useMemo(() => {
    if (activeTab === "overview") return <BdmOverview />;
    if (activeTab === "leads") return <BdmLeads user={user} />;
    if (activeTab === "onboarding") return <BdmOnboarding />;
    if (activeTab === "clients") return <BdmClients />;
    return <BdmTechRequests />;
  }, [activeTab, user]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          padding: "12px 14px",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>BDM Command Center</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            Welcome, {user.email}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setChangePwOpen(true)}
            aria-label="Change password"
            title="Change password"
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.65)",
              padding: "8px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ⚙
          </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            aria-label="Toggle notifications"
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              padding: "8px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 16,
              position: "relative",
            }}
          >
            🔔
            {unreadCount > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  background: "#EF4444",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                marginTop: 8,
                width: 360,
                maxWidth: "90vw",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "#0B1324",
                padding: 10,
                zIndex: 40,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Notifications</p>
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#9CE7FF",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  Mark all read
                </button>
              </div>

              {notifications.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>No unread notifications.</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)",
                      padding: "8px 10px",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{notification.title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>{notification.message}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.58)" }}>
                      {new Date(notification.createdAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: 10,
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                borderRadius: 10,
                border: active ? "1px solid rgba(79,209,255,0.45)" : "1px solid rgba(255,255,255,0.12)",
                background: active ? "rgba(79,209,255,0.12)" : "rgba(255,255,255,0.04)",
                color: active ? "#9CE7FF" : "rgba(255,255,255,0.85)",
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabContent}
    </div>
  );
}
