"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { blockGap, sectionDivider, sectionY } from "./spacing";

type ChannelCard = {
  name: "WhatsApp" | "Instagram" | "Facebook" | "Email" | "SMS";
  glow: string;
  iconBg: string;
  icon: ComponentType<{ className?: string }>;
};

const channels: ChannelCard[] = [
  {
    name: "WhatsApp",
    glow: "hover:shadow-[0_0_30px_-12px_rgba(34,197,94,0.85)] hover:border-green-400/40",
    iconBg: "bg-green-500/15",
    icon: WhatsAppIcon,
  },
  {
    name: "Instagram",
    glow: "hover:shadow-[0_0_30px_-12px_rgba(244,114,182,0.8)] hover:border-pink-400/40",
    iconBg: "bg-gradient-to-br from-fuchsia-500/20 via-pink-500/20 to-orange-400/20",
    icon: InstagramIcon,
  },
  {
    name: "Facebook",
    glow: "hover:shadow-[0_0_30px_-12px_rgba(59,130,246,0.85)] hover:border-blue-400/40",
    iconBg: "bg-blue-500/15",
    icon: FacebookIcon,
  },
  {
    name: "Email",
    glow: "hover:shadow-[0_0_30px_-12px_rgba(148,163,184,0.7)] hover:border-slate-300/35",
    iconBg: "bg-slate-400/10",
    icon: EmailIcon,
  },
  {
    name: "SMS",
    glow: "hover:shadow-[0_0_30px_-12px_rgba(134,239,172,0.75)] hover:border-lime-300/40",
    iconBg: "bg-lime-400/15",
    icon: SmsIcon,
  },
];
const benefits = [
  "Auto lead capture",
  "Auto follow-ups",
  "No missed enquiries",
  "Smart routing",
] as const;

export function SalesBoosterHighlight() {
  return (
    <SectionReveal id="sales-booster" className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] via-[#121821] to-[#1f1b3a] p-8 shadow-[0_0_70px_-20px_rgba(99,102,241,0.45)] sm:p-10">
          <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your Sales Engine, Running 24/7
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            Connect WhatsApp, Instagram, Facebook and more. BGOS captures leads, assigns them, and follows up automatically using Nexa.
          </p>

          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-5 ${blockGap}`}>
            {channels.map((channel) => (
              <motion.div
                key={channel.name}
                whileHover={{ y: -4, scale: 1.015 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className={`rounded-2xl border border-white/10 bg-[#0f1524]/85 p-4 transition-all duration-200 ${channel.glow}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${channel.iconBg}`}>
                    <channel.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">{channel.name}</p>
                    <p className="text-xs text-white/55">Ready to connect</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-4 inline-flex min-h-[34px] w-full items-center justify-center rounded-lg border border-white/15 bg-white/[0.03] px-3 text-xs font-medium text-white/85 transition hover:bg-white/[0.08]"
                >
                  Connect
                </button>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {benefits.map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/sales-booster"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-7 text-sm font-semibold tracking-wide text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110"
            >
              Explore Sales Booster
            </Link>
          </div>
        </div>
      </Container>
    </SectionReveal>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 01-11.55 7.17L4 20l.86-4.16A8 8 0 1112 20"
        stroke="#22c55e"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.7 9.8c.3-.6.64-.6.94-.6h.28c.1 0 .24.04.36.31.13.28.45 1.1.49 1.18.04.08.06.18 0 .28a3.9 3.9 0 01-.57.71c-.08.08-.16.17-.07.33.08.16.37.62.8 1 .56.5 1.03.65 1.18.73.15.08.24.07.33-.04.1-.12.4-.46.5-.61.1-.16.2-.13.33-.08.14.05.88.42 1.03.5.16.08.26.12.3.2.03.09.03.5-.12.99-.15.49-.86.94-1.2.99-.32.05-.72.07-1.16-.08-.26-.09-.6-.2-1.04-.4-1.84-.8-3.03-2.7-3.13-2.83-.1-.14-.75-1-.75-1.9 0-.9.47-1.35.64-1.53z"
        fill="#22c55e"
      />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4.5" y="4.5" width="15" height="15" rx="4.4" stroke="url(#ig-grad)" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" stroke="url(#ig-grad)" strokeWidth="1.8" />
      <circle cx="16.8" cy="7.4" r="1" fill="#f472b6" />
      <defs>
        <linearGradient id="ig-grad" x1="5" y1="19" x2="19" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f97316" />
          <stop offset="0.45" stopColor="#ec4899" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 8.5h2V6h-2.4c-2.3 0-3.6 1.4-3.6 3.9V12H8v2.6h2V20h2.7v-5.4h2.5L15.6 12h-2.9V9.9c0-.9.3-1.4 1.3-1.4z"
        fill="#3b82f6"
      />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.8" y="6.3" width="16.4" height="11.4" rx="2.2" stroke="#cbd5e1" strokeWidth="1.8" />
      <path d="M5 8l7 5 7-5" stroke="#e2e8f0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 7.5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2V15c0 1.1.9 2 2 2h2v2l2.7-2H18c1.1 0 2-.9 2-2V7.5z"
        stroke="#86efac"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11.4" r="1" fill="#86efac" />
      <circle cx="12" cy="11.4" r="1" fill="#86efac" />
      <circle cx="15" cy="11.4" r="1" fill="#86efac" />
    </svg>
  );
}
