"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { blockGap, sectionDivider, sectionY } from "./spacing";
import { useId, useRef, type ComponentType } from "react";

const features = [
  {
    title: "Lead Capture",
    desc: "Turn interest into pipeline automatically.",
    icon: LeadIcon,
  },
  {
    title: "AI Follow-ups",
    desc: "NEXA keeps conversations warm, 24/7.",
    icon: AiIcon,
  },
  {
    title: "CRM Pipeline",
    desc: "One calm view of every deal stage.",
    icon: PipelineIcon,
  },
  {
    title: "Campaign Automation",
    desc: "Launch, learn, and optimize in sync.",
    icon: CampaignIcon,
  },
  {
    title: "Smart Reports",
    desc: "Signal over noise — always.",
    icon: ReportIcon,
  },
  {
    title: "Automation Engine",
    desc: "Compose workflows that scale with you.",
    icon: EngineIcon,
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
        className="stroke-yellow-400"
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
        className="stroke-yellow-400"
        strokeWidth="2"
        strokeLinecap="round"
        animate={{ opacity: [0.45, 0.95, 0.45] }}
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
          className="stroke-red-500/70"
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
          className="fill-white/15 stroke-yellow-400/45"
          strokeWidth="1"
          animate={{ opacity: [0.4, 0.85, 0.4], y: [1, 0, 1] }}
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
      <circle cx="26" cy="8" r="2.5" className="fill-yellow-400/85" />
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
        className="stroke-white/25"
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

function EngineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <motion.g
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "16px 16px" }}
      >
        <circle
          cx="16"
          cy="16"
          r="9"
          className="stroke-red-500/55"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          fill="none"
        />
      </motion.g>
      <circle cx="16" cy="16" r="3" className="fill-yellow-400/80" />
    </svg>
  );
}

function TiltFeatureCard({
  title,
  desc,
  icon: Icon,
}: {
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
}) {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springMx = useSpring(mx, { stiffness: 220, damping: 28 });
  const springMy = useSpring(my, { stiffness: 220, damping: 28 });
  const rotateX = useTransform(springMy, [-0.5, 0.5], [4, -4]);
  const rotateY = useTransform(springMx, [-0.5, 0.5], [-4, 4]);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.article
      ref={ref}
      variants={staggerItem}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={{
        y: -4,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="group relative rounded-xl border border-white/[0.08] bg-white/[0.045] p-8 shadow-lg backdrop-blur-lg transition-[box-shadow,border-color] duration-500 ease-out hover:border-yellow-400/25 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(250,204,21,0.08)]"
    >
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
      <p className="mt-4 text-sm font-normal leading-relaxed tracking-wide text-gray-400">
        {desc}
      </p>
    </motion.article>
  );
}

export function Features() {
  return (
    <SectionReveal className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={staggerItem}
            className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem]"
          >
            Features
          </motion.h2>

          <div
            className={`grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 ${blockGap}`}
            style={{ perspective: "1200px" }}
          >
            {features.map((f) => (
              <TiltFeatureCard
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
