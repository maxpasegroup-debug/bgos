"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

const WA_SALES =
  "https://wa.me/918089239823?text=Hi%20I%20want%20BGOS%20Sales%20Booster";

const CHANNELS = [
  { id: "wa", name: "WhatsApp", color: "from-emerald-500/25 to-emerald-600/10", icon: IconWhatsApp },
  { id: "ig", name: "Instagram", color: "from-pink-500/25 to-purple-600/10", icon: IconInstagram },
  { id: "fb", name: "Facebook", color: "from-blue-500/25 to-blue-700/10", icon: IconFacebook },
  { id: "email", name: "Email", color: "from-slate-400/20 to-slate-600/10", icon: IconEmail },
  { id: "sms", name: "SMS", color: "from-cyan-500/20 to-teal-600/10", icon: IconSms },
  { id: "tg", name: "Telegram", color: "from-sky-500/25 to-blue-600/10", icon: IconTelegram },
  { id: "web", name: "Website Chatbot", color: "from-amber-500/20 to-orange-600/10", icon: IconChat },
  { id: "voice", name: "Voice", color: "from-violet-500/25 to-fuchsia-600/10", icon: IconVoice },
] as const;

const BENEFITS = [
  "Auto Lead Capture",
  "AI Follow-Ups",
  "Smart Lead Routing",
  "Conversion Tracking",
  "Unified Inbox",
  "Missed Lead Recovery",
];

export function SalesBoosterLandingClient() {
  const scrollChannels = useCallback(() => {
    document.getElementById("sales-booster-channels")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className={`relative min-h-0 flex-1 overflow-y-auto ${BGOS_MAIN_PAD} pb-20 pt-8`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,195,0,0.12),transparent)]" />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-4xl text-center"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#FFC300]/80">
          Revenue engine
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Sales Booster <span className="inline-block">🚀</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-[#FFC300]/90 sm:text-xl">
          Turn Conversations into Revenue
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Connect your channels. Nexa handles leads, follow-ups, and conversions automatically.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={scrollChannels}
            className="w-full min-w-[200px] rounded-2xl border border-[#FFC300]/40 bg-gradient-to-r from-[#FF3B3B]/15 to-[#FFC300]/20 px-8 py-4 text-sm font-semibold text-[#FFE8A8] shadow-[0_0_32px_-8px_rgba(255,195,0,0.45)] transition hover:from-[#FF3B3B]/25 hover:to-[#FFC300]/30 sm:w-auto"
          >
            Explore Sales Booster
          </button>
          <Link
            href="/bgos/subscription"
            className="w-full min-w-[200px] rounded-2xl border border-white/15 bg-white/[0.06] px-8 py-4 text-center text-sm font-semibold text-white transition hover:bg-white/[0.1] sm:w-auto"
          >
            Upgrade to Pro
          </Link>
          <a
            href={WA_SALES}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-w-[200px] rounded-2xl border border-white/10 bg-black/40 px-8 py-4 text-center text-sm font-semibold text-white/90 backdrop-blur-sm transition hover:border-[#25D366]/40 hover:text-white sm:w-auto"
          >
            Talk to BGOS Team (WhatsApp)
          </a>
        </div>
      </motion.section>

      <motion.section
        id="sales-booster-channels"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto mt-24 max-w-6xl"
      >
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
          Your channels — one command center
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-white/55">
          Link every place customers talk to you. BGOS keeps the story in one place.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((ch, i) => (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${ch.color} p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm transition-[box-shadow] hover:border-[#FFC300]/35 hover:shadow-[0_0_40px_-12px_rgba(255,195,0,0.35)]`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 text-white">
                  <ch.icon className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55">
                  Not connected
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{ch.name}</h3>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-white/15 bg-black/25 py-2.5 text-sm font-medium text-white/90 transition group-hover:border-[#FFC300]/40 group-hover:text-[#FFE8A8]"
              >
                Connect
              </button>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="relative mx-auto mt-24 max-w-5xl"
      >
        <h2 className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
          What you get
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((title, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center"
            >
              <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#FFC300]/20 text-sm font-bold text-[#FFC300]">
                {i + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-white">{title}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mx-auto mt-24 max-w-3xl rounded-3xl border border-[#FFC300]/25 bg-gradient-to-br from-[#FFC300]/[0.08] to-[#FF3B3B]/[0.06] p-10 text-center shadow-[0_0_60px_-20px_rgba(255,195,0,0.35)]"
      >
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Activate your Sales Engine</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/65">
          Move to Pro to open the full Sales Booster workspace — automations, inbox, and performance in
          one view.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/bgos/subscription"
            className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#FFC300] px-10 text-sm font-bold text-black transition hover:bg-[#ffdb4d]"
          >
            Upgrade to Pro
          </Link>
          <a
            href={WA_SALES}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-white/20 bg-black/30 px-10 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Contact Sales
          </a>
        </div>
      </motion.section>
    </div>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.52 3.45A11.87 11.87 0 0012.06 0C5.97 0 .96 5.01.96 11.1c0 1.96.51 3.87 1.48 5.55L.06 24l7.47-1.96a11.82 11.82 0 005.53 1.42h.01c6.09 0 11.1-5.01 11.1-11.1 0-2.97-1.16-5.76-3.27-7.86zM12.07 21.1h-.01a9.1 9.1 0 01-4.65-1.27l-.33-.2-3.45.9.92-3.37-.22-.35a9.08 9.08 0 01-1.39-4.83c0-5.01 4.07-9.08 9.09-9.08 2.43 0 4.71.95 6.42 2.66a9.02 9.02 0 012.66 6.41c0 5.03-4.07 9.1-9.09 9.1zm5-6.44c-.28-.14-1.65-.81-1.9-.9-.26-.1-.45-.14-.64.14-.19.28-.73.9-.9 1.08-.16.18-.33.2-.61.07-.28-.14-1.18-.44-2.25-1.39-.83-.74-1.39-1.66-1.55-1.94-.16-.28-.02-.44.12-.58.13-.13.28-.33.42-.5.14-.17.19-.28.28-.47.1-.19.05-.36-.02-.5-.07-.14-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49l-.54-.01c-.19 0-.5.07-.76.36s-.99 1.02-1.17 1.25c-.2.23-.38.26-.66.09-.28-.17-1.18-.43-2.25-1.38-.83-.75-1.39-1.67-1.55-1.94-.16-.28-1.55-2.07-1.55-2.47 0-.39.18-.54.27-.63.28-.28.61-.36.76-.49.18-.16.34-.38.51-.64.02-.02.04-.04.05-.06.02-.03.04-.05.05-.08.09-.15.14-.28.19-.45.02-.06.03-.12.03-.18 0-.04-.01-.08-.02-.13-.05-.28-.73-1.77-.99-2.42-.12-.28-.24-.24-.66-.25-.17 0-.35.01-.55.03-.53.06-1.42.4-1.62.96-.05.12-.08.26-.13.42-.25.77-.87 2.1-.93 2.26-.07.16-.14.18-.23.11-.66-.55-2.44-1.21-2.86-2.46-.02-.06-.04-.11-.06-.16-.11-.29-.26-.79.09-1.34.39-.63 1.38-1.9 2.98-1.9h.68c.67.01 1.37.25 1.75.47 1.06.61 2.05 1.97 2.15 2.48.1.51.08.84.02 1.05-.08.28-.25.43-.43.53z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IconEmail({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconSms({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.1.355l-3.48 7.03c-.1.18-.28.22-.465.13l-2.64-1.19-1.47 1.49c-.17.17-.45.02-.51-.18l-.55-1.87-3.47-1.42c-.28-.12-.29-.29.06-.44l13.57-5.23c.15-.06.28-.03.4.06z" />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function IconVoice({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}
