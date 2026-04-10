"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { blockGap, sectionDivider, sectionY } from "./spacing";
import { useId, type ComponentType } from "react";

const features = [
  {
    title: "Track every enquiry",
    desc: "Keep every lead in one clear list.",
    icon: LeadIcon,
  },
  {
    title: "Respond faster",
    desc: "Automated reminders help your team reply quickly.",
    icon: AiIcon,
  },
  {
    title: "See your deals clearly",
    desc: "Know what is pending, moving, or won.",
    icon: PipelineIcon,
  },
  {
    title: "Save time daily",
    desc: "Simple automation handles repeated work.",
    icon: CampaignIcon,
  },
  {
    title: "Keep your team aligned",
    desc: "Everyone knows who owns each lead.",
    icon: ReportIcon,
  },
] as const;

function LeadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <motion.g
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "12px 14px" }}
      >
        <circle
          cx="12"
          cy="14"
          r="5"
          className="stroke-red-500"
          strokeWidth="2"
          fill="none"
        />
      </motion.g>
      <motion.path
        d="M 20 22 L 26 28"
        className="stroke-amber-400"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 1.2,
          ease: [0.4, 0, 0.2, 1],
          repeat: Infinity,
          repeatDelay: 3.5,
        }}
      />
    </svg>
  );
}

function AiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <motion.path
        d="M8 16h16M16 8v16"
        className="stroke-amber-500"
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "16px 16px" }}
      >
        <circle
          cx="16"
          cy="16"
          r="10"
          className="stroke-red-500/60"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          fill="none"
        />
      </motion.g>
    </svg>
  );
}

function PipelineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      {[8, 16, 24].map((x, i) => (
        <motion.rect
          key={x}
          x={x - 3}
          y="10"
          width="6"
          height="12"
          rx="2"
          className="fill-slate-200 stroke-amber-400/50"
          strokeWidth="1"
          animate={{ opacity: [0.55, 1, 0.55], y: [1, 0, 1] }}
          transition={{
            duration: 3.5,
            delay: i * 0.35,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </svg>
  );
}

function CampaignIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <motion.path
        d="M6 22 L12 14 L18 18 L26 8"
        className="stroke-red-500"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 2.4,
          ease: [0.4, 0, 0.2, 1],
          repeat: Infinity,
          repeatDelay: 3,
        }}
      />
      <circle cx="26" cy="8" r="2.5" className="fill-amber-400" />
    </svg>
  );
}

function ReportIcon({ className }: { className?: string }) {
  const gradId = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="3"
        className="stroke-slate-300"
        strokeWidth="1.5"
        fill="none"
      />
      <motion.path
        d="M10 22 L14 16 L18 20 L24 12"
        stroke={`url(#repGrad-${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 2.2,
          ease: [0.4, 0, 0.2, 1],
          repeat: Infinity,
          repeatDelay: 4,
        }}
      />
      <defs>
        <linearGradient id={`repGrad-${gradId}`} x1="0" x2="1">
          <stop stopColor="#ef4444" />
          <stop offset="1" stopColor="#facc15" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FeatureCard({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <motion.article
      variants={staggerItem}
      whileHover={{
        y: -6,
        transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
      }}
      className="group rounded-xl border border-white/10 bg-white/[0.03] p-8 shadow-sm transition-shadow duration-300 hover:border-indigo-300/40 hover:shadow-lg hover:shadow-indigo-500/[0.2]"
    >
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] shadow-sm transition-shadow duration-300 group-hover:shadow-md">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-3 text-sm font-normal leading-relaxed tracking-wide text-white/65">
        {desc}
      </p>
    </motion.article>
  );
}

export function Features() {
  return (
    <SectionReveal id="features" className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={staggerItem}
            className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            What You Get
          </motion.h2>

          <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${blockGap}`}>
            {features.map((f) => (
              <FeatureCard
                key={f.title}
                title={f.title}
                desc={f.desc}
                icon={f.icon}
              />
            ))}
          </div>
        </motion.div>
      </Container>
    </SectionReveal>
  );
}
