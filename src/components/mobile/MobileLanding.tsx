"use client";

/**
 * MobileLanding — mobile-first landing page for BGOS.
 *
 * Completely independent of the desktop Landing component.
 * Vertical scroll, large text, no clutter.
 *
 * Sections:
 *   1. Hero
 *   2. How It Works (3 steps)
 *   3. Earn ₹30K+
 *   4. Features (cards)
 *   5. CTA
 */

import Link from "next/link";

// ---------------------------------------------------------------------------
// Design tokens (inline — no desktop design-system import)
// ---------------------------------------------------------------------------

const BG    = "#070A0E";
const CYAN  = "#4FD1FF";
const VIO   = "#7C5CFF";

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function IcoUserPlus() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        d="M16 11c1.66 0 2.99 1.34 2.99 3S17.66 17 16 17m3 5s-.34-2.12-3-2.12M1 20s.29-4 5-4 5 4 5 4M8 13a4 4 0 100-8 4 4 0 000 8zM20 8v6m3-3h-6" />
    </svg>
  );
}

function IcoPhone() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        d="M6.6 10.8a15.05 15.05 0 006.6 6.6l2.2-2.2a1 1 0 011.05-.24 11.5 11.5 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.19 2.46.57 3.58a1 1 0 01-.24 1.05L6.6 10.8z" />
    </svg>
  );
}

function IcoWallet() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        d="M3 10h18M7 15h.01M11 15h2m-8-5V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z" />
    </svg>
  );
}

function IcoWhatsapp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        d="M3 21l1.65-4.88A8.5 8.5 0 1121 12.5a8.5 8.5 0 01-8.5 8.5 8.46 8.46 0 01-4.62-1.37L3 21z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Hero
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section
      className="relative overflow-hidden px-5 pt-20 pb-16 text-center"
      style={{ background: `linear-gradient(180deg, ${BG} 0%, #0D1018 100%)` }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[320px] h-[320px] rounded-full opacity-20"
        style={{ background: `radial-gradient(circle, ${CYAN} 0%, transparent 65%)`, filter: "blur(60px)" }}
        aria-hidden
      />

      {/* Eyebrow */}
      <span
        className="inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-6"
        style={{ borderColor: `${CYAN}30`, color: CYAN, background: `${CYAN}10` }}
      >
        Business Growth OS
      </span>

      {/* Headline */}
      <h1 className="text-[38px] font-extrabold leading-[1.1] tracking-tight text-white mb-4">
        Close Deals.{" "}
        <span
          className="block"
          style={{
            background: `linear-gradient(90deg, ${CYAN}, ${VIO})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Earn More.
        </span>
      </h1>

      {/* Subtext */}
      <p className="text-[16px] leading-relaxed text-white/55 max-w-[300px] mx-auto mb-10">
        BGOS gives your sales team leads, tracking, and earnings — all in one app.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 max-w-[300px] mx-auto">
        <Link
          href="/onboarding/nexa"
          className="flex h-[52px] items-center justify-center rounded-2xl text-[15px] font-bold text-white tracking-wide shadow-lg active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${CYAN}, ${VIO})` }}
        >
          Get Started Free
        </Link>
        <a
          href="https://wa.me/918089239823?text=Hi%20I%20want%20BGOS"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[48px] items-center justify-center gap-2 rounded-2xl border text-[14px] font-semibold text-white/70 active:scale-95 transition-transform"
          style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
        >
          <IcoWhatsapp />
          Talk to Team
        </a>
      </div>

      {/* Social proof strip */}
      <div className="mt-10 flex items-center justify-center gap-4">
        <div className="flex -space-x-2">
          {["#4FD1FF", "#7C5CFF", "#22C55E", "#F59E0B"].map((c, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-[#070A0E]"
              style={{ background: c, opacity: 0.85 }}
            />
          ))}
        </div>
        <p className="text-[12px] text-white/35">
          500+ businesses running on BGOS
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — How It Works
// ---------------------------------------------------------------------------

const STEPS = [
  {
    n: "01",
    icon: IcoUserPlus,
    title: "Join & Get Set Up",
    desc: "Your account, team, and leads are ready in minutes.",
    color: CYAN,
  },
  {
    n: "02",
    icon: IcoPhone,
    title: "Work Your Pipeline",
    desc: "Call, track, and close deals from your phone.",
    color: VIO,
  },
  {
    n: "03",
    icon: IcoWallet,
    title: "Get Paid",
    desc: "Earnings credited automatically. Withdraw anytime.",
    color: "#22C55E",
  },
];

function HowItWorksSection() {
  return (
    <section className="px-5 py-16" style={{ background: "#0A0D12" }}>
      {/* Label */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2 text-center"
        style={{ color: CYAN }}
      >
        How It Works
      </p>
      <h2 className="text-[28px] font-bold text-white text-center leading-tight mb-10">
        Three steps to success
      </h2>

      {/* Steps */}
      <div className="flex flex-col gap-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.n}
              className="flex items-start gap-4 rounded-2xl border border-white/[0.07] p-5"
              style={{ background: "rgba(255,255,255,0.025)" }}
            >
              {/* Icon circle */}
              <div
                className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}25` }}
              >
                <Icon />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <span className="text-[11px] font-bold tabular-nums" style={{ color: `${s.color}70` }}>
                  {s.n}
                </span>
                <p className="text-[16px] font-bold text-white leading-snug mt-0.5">{s.title}</p>
                <p className="text-[13px] text-white/45 mt-1 leading-snug">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Earn ₹30K+
// ---------------------------------------------------------------------------

function EarnSection() {
  const tiers = [
    { role: "Sales Exec",   range: "₹15K – ₹30K", note: "Per month · direct commissions",  accent: "#22C55E" },
    { role: "Team Lead",    range: "₹30K – ₹60K", note: "Per month · team + overrides",     accent: CYAN     },
    { role: "Region Head",  range: "₹60K+",        note: "Per month · network earnings",     accent: VIO      },
  ];

  return (
    <section className="px-5 py-16 relative overflow-hidden" style={{ background: BG }}>
      {/* Glow */}
      <div
        className="pointer-events-none absolute right-0 top-0 w-[220px] h-[220px] rounded-full opacity-15"
        style={{ background: `radial-gradient(circle, ${VIO} 0%, transparent 70%)`, filter: "blur(50px)" }}
        aria-hidden
      />

      {/* Label */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
        style={{ color: "#F59E0B" }}
      >
        Earn With BGOS
      </p>

      <h2 className="text-[32px] font-extrabold text-white leading-tight mb-2">
        Earn{" "}
        <span
          style={{
            background: "linear-gradient(90deg, #F59E0B, #EF4444)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ₹30,000+
        </span>
      </h2>
      <p className="text-[15px] text-white/50 leading-relaxed mb-8 max-w-[300px]">
        Build your pipeline, close deals, and unlock recurring monthly bonuses.
      </p>

      {/* Tier cards */}
      <div className="flex flex-col gap-3">
        {tiers.map((t) => (
          <div
            key={t.role}
            className="flex items-center justify-between rounded-2xl border px-4 py-4"
            style={{
              borderColor: `${t.accent}20`,
              background: `${t.accent}08`,
            }}
          >
            <div>
              <p className="text-[13px] font-semibold text-white/60">{t.role}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{t.note}</p>
            </div>
            <p className="text-[18px] font-bold" style={{ color: t.accent }}>
              {t.range}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-white/20 mt-4 text-center">
        Earnings vary based on performance and plan type
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Features
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: "🎯",
    title: "Lead Tracking",
    desc: "Every enquiry captured, assigned, and followed up automatically.",
    glow: CYAN,
  },
  {
    icon: "💸",
    title: "Live Wallet",
    desc: "Watch your earnings grow in real time and withdraw on demand.",
    glow: "#22C55E",
  },
  {
    icon: "⚡",
    title: "Nexa AI Nudges",
    desc: "Daily micro-prompts keep you on track and closing more deals.",
    glow: "#F59E0B",
  },
  {
    icon: "👥",
    title: "Team Network",
    desc: "Build your BDM/RSM network and earn on every deal they close.",
    glow: VIO,
  },
  {
    icon: "📊",
    title: "Performance Reports",
    desc: "See your progress, milestones, and rankings at a glance.",
    glow: "#EC4899",
  },
];

function FeaturesSection() {
  return (
    <section className="px-5 py-16" style={{ background: "#0A0D12" }}>
      {/* Label */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2 text-center"
        style={{ color: VIO }}
      >
        Platform
      </p>
      <h2 className="text-[28px] font-bold text-white text-center leading-tight mb-10">
        Everything you need
      </h2>

      {/* Feature cards grid */}
      <div className="flex flex-col gap-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-4 rounded-2xl border border-white/[0.06] p-4"
            style={{ background: `${f.glow}06` }}
          >
            <span
              className="text-2xl w-11 h-11 shrink-0 flex items-center justify-center rounded-xl"
              style={{ background: `${f.glow}12`, border: `1px solid ${f.glow}20` }}
            >
              {f.icon}
            </span>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[15px] font-bold text-white leading-snug">{f.title}</p>
              <p className="text-[13px] text-white/45 mt-1 leading-snug">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — CTA
// ---------------------------------------------------------------------------

function CtaSection() {
  return (
    <section className="px-5 py-16 text-center relative overflow-hidden" style={{ background: BG }}>
      {/* Glow orbs */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full opacity-20"
        style={{ background: `radial-gradient(circle, ${VIO} 0%, transparent 65%)`, filter: "blur(60px)" }}
        aria-hidden
      />

      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/35 mb-3">
        Ready to start?
      </p>

      <h2 className="text-[30px] font-extrabold text-white leading-tight mb-3">
        Build your sales empire{" "}
        <span
          style={{
            background: `linear-gradient(90deg, ${CYAN}, ${VIO})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          this month
        </span>
      </h2>

      <p className="text-[15px] text-white/40 max-w-[280px] mx-auto mb-10 leading-relaxed">
        Join hundreds of businesses already running on BGOS.
      </p>

      <div className="flex flex-col gap-3 max-w-[300px] mx-auto">
        <Link
          href="/onboarding/nexa"
          className="flex h-[54px] items-center justify-center rounded-2xl text-[16px] font-bold text-white tracking-wide active:scale-95 transition-transform relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${CYAN}, ${VIO})` }}
        >
          {/* Shine overlay */}
          <span
            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
            aria-hidden
          />
          <span className="relative">Start Now →</span>
        </Link>

        <a
          href="https://wa.me/918089239823?text=Hi%20I%20want%20BGOS"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[48px] items-center justify-center gap-2 rounded-2xl border text-[14px] font-semibold text-white/60 active:scale-95 transition-transform"
          style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
        >
          <IcoWhatsapp />
          Talk to Team on WhatsApp
        </a>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Minimal mobile header (no desktop nav)
// ---------------------------------------------------------------------------

function MobileHeader() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between px-5"
      style={{ background: `${BG}E6`, backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Logo */}
      <span
        className="text-[15px] font-black tracking-[0.16em]"
        style={{
          background: `linear-gradient(90deg, ${CYAN}, ${VIO})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        BGOS
      </span>

      {/* Login link */}
      <Link
        href="/internal/login"
        className="rounded-xl border px-4 py-1.5 text-[12px] font-semibold text-white/60"
        style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}
      >
        Login
      </Link>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Minimal mobile footer
// ---------------------------------------------------------------------------

function MobileFooter() {
  return (
    <footer
      className="px-5 py-8 text-center border-t"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "#05070A" }}
    >
      <span
        className="text-[13px] font-bold tracking-[0.14em]"
        style={{
          background: `linear-gradient(90deg, ${CYAN}, ${VIO})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        BGOS
      </span>
      <p className="text-[11px] text-white/20 mt-2">
        © {new Date().getFullYear()} Business Growth Operating System
      </p>
      <div className="flex justify-center gap-5 mt-4">
        {[
          { label: "Privacy", href: "/legal/privacy" },
          { label: "Terms",   href: "/legal/terms"   },
        ].map((l) => (
          <Link key={l.label} href={l.href} className="text-[11px] text-white/25">
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// MobileLanding (exported)
// ---------------------------------------------------------------------------

export function MobileLanding() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-white antialiased"
      style={{ background: BG }}
    >
      <MobileHeader />

      {/* Top padding to clear fixed header */}
      <div className="pt-14">
        <HeroSection />
        <HowItWorksSection />
        <EarnSection />
        <FeaturesSection />
        <CtaSection />
        <MobileFooter />
      </div>
    </div>
  );
}
