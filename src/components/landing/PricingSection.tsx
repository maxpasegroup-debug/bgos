"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { blockGap, sectionDivider, sectionY } from "./spacing";

const WA_LINK =
  "https://wa.me/918089239823?text=Hi%20I%20want%20BGOS%20Enterprise%20plan";

export function PricingSection() {
  return (
    <SectionReveal id="pricing" className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Simple Plans That Grow With You
        </h2>
        <p className="mt-4 text-center text-sm text-white/65 sm:text-base">
          Start free. Upgrade anytime.
        </p>

        <div className={`grid gap-6 lg:grid-cols-3 ${blockGap}`}>
          <PlanCard
            title="Basic"
            price="₹6000/month"
            points={["Manage your business"]}
            ctaLabel="Start Free Trial"
            ctaHref="/signup"
          />
          <PlanCard
            title="Pro"
            price="₹12000/month"
            points={["Everything in Basic", "Sales Booster included"]}
            ctaLabel="Upgrade to Pro"
            ctaHref="/signup"
            highlight
            badge="Most Popular"
          />
          <PlanCard
            title="Enterprise"
            price="Custom"
            points={["Multi-business expansion", "Custom setup"]}
            ctaLabel="Contact Sales"
            ctaHref={WA_LINK}
            external
          />
        </div>
      </Container>
    </SectionReveal>
  );
}

function PlanCard({
  title,
  price,
  points,
  ctaLabel,
  ctaHref,
  highlight,
  badge,
  external,
}: {
  title: string;
  price: string;
  points: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  badge?: string;
  external?: boolean;
}) {
  const className = `relative rounded-2xl border p-6 ${
    highlight
      ? "border-indigo-300/45 bg-gradient-to-b from-indigo-500/25 to-violet-500/10 shadow-[0_0_40px_-14px_rgba(99,102,241,0.55)]"
      : "border-white/10 bg-white/[0.03]"
  }`;

  const ctaClass =
    "mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-4 text-sm font-semibold text-white transition hover:brightness-110";

  return (
    <motion.article whileHover={{ y: -4 }} transition={{ duration: 0.3 }} className={className}>
      {badge ? (
        <span className="absolute right-4 top-4 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-100">
          {badge}
        </span>
      ) : null}
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{price}</p>
      <ul className="mt-5 space-y-2 text-sm text-white/70">
        {points.map((p) => (
          <li key={p}>- {p}</li>
        ))}
      </ul>
      {external ? (
        <a href={ctaHref} target="_blank" rel="noopener noreferrer" className={ctaClass}>
          {ctaLabel}
        </a>
      ) : (
        <Link href={ctaHref} className={ctaClass}>
          {ctaLabel}
        </Link>
      )}
    </motion.article>
  );
}
