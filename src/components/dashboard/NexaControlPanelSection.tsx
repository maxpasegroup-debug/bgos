"use client";

import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  },
};

const NEXA_RESPONSE =
  "Boss, 3 leads are ready to close. I recommend immediate follow-up.";

const quickActions = [
  "Follow up all hot leads",
  "Optimize pipeline",
  "Show weak points",
] as const;

export function NexaControlPanelSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: false, margin: "-12%" });
  const reduceMotion = useReducedMotion();
  const [typeTrigger, setTypeTrigger] = useState(0);

  const replayTyping = () => setTypeTrigger((t) => t + 1);

  return (
    <motion.section
      ref={sectionRef}
      id="nexa"
      className="scroll-mt-28 border-t border-white/10 pb-14 pt-10 sm:pb-16 sm:pt-11"
      variants={sectionVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8%" }}
    >
      <motion.div variants={itemVariants} className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
          NEXA AI
        </span>
        <span className="text-lg font-semibold text-white">Control Panel</span>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-2xl p-[1px]"
        animate={
          reduceMotion
            ? undefined
            : {
                boxShadow: [
                  "0 0 0 1px rgba(255, 195, 0, 0.15), 0 0 32px rgba(255, 59, 59, 0.08), 0 0 48px rgba(255, 195, 0, 0.06)",
                  "0 0 0 1px rgba(255, 195, 0, 0.32), 0 0 44px rgba(255, 59, 59, 0.12), 0 0 64px rgba(255, 195, 0, 0.1)",
                  "0 0 0 1px rgba(255, 195, 0, 0.15), 0 0 32px rgba(255, 59, 59, 0.08), 0 0 48px rgba(255, 195, 0, 0.06)",
                ],
              }
        }
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        whileHover={
          reduceMotion
            ? undefined
            : { y: -4, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }
        }
      >
        <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#FFC300]/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#FF3B3B]/10 blur-3xl"
            aria-hidden
          />

          <div className="relative space-y-5">
            <div className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFC300]/90">
                NEXA
              </p>
              <TypewriterMessage
                text={NEXA_RESPONSE}
                active={isInView}
                runId={typeTrigger}
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Quick actions
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {quickActions.map((label) => (
                  <motion.button
                    key={label}
                    type="button"
                    onClick={replayTyping}
                    whileHover={
                      reduceMotion
                        ? undefined
                        : {
                            scale: 1.02,
                            borderColor: "rgba(255, 195, 0, 0.35)",
                            boxShadow:
                              "0 0 22px rgba(255, 59, 59, 0.18), 0 0 36px rgba(255, 195, 0, 0.08)",
                          }
                    }
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-left text-xs font-medium text-white/85 transition-colors hover:bg-white/[0.08] sm:text-sm"
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
            </div>

            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                replayTyping();
              }}
            >
              <input
                type="text"
                name="nexa-query"
                placeholder="Ask Nexa anything..."
                className="min-h-[48px] flex-1 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/35 outline-none ring-0 transition-[border-color,box-shadow] focus:border-[#FFC300]/40 focus:shadow-[0_0_0_3px_rgba(255,195,0,0.12)]"
                autoComplete="off"
              />
              <motion.button
                type="submit"
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.02,
                        boxShadow:
                          "0 0 28px rgba(255, 59, 59, 0.45), 0 0 48px rgba(255, 195, 0, 0.15)",
                      }
                }
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-[48px] shrink-0 rounded-xl bg-gradient-to-r from-[#FF3B3B] to-[#FFC300] px-6 text-sm font-semibold text-[#0B0F19] shadow-lg shadow-[0_0_25px_rgba(255,59,59,0.25)]"
              >
                Send
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}

function TypewriterMessage({
  text,
  active,
  runId,
}: {
  text: string;
  active: boolean;
  runId: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!active) return;

    let intervalId: number | undefined;
    const ms = 26;

    const timeoutId = window.setTimeout(() => {
      setDisplayed("");
      setComplete(false);
      let i = 0;
      intervalId = window.setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (intervalId) window.clearInterval(intervalId);
          setComplete(true);
        }
      }, ms);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [text, active, runId]);

  return (
    <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-white/90 sm:min-h-[3rem] sm:text-base">
      {displayed}
      {!complete ? (
        <motion.span
          className="ml-0.5 inline-block w-2 text-[#FFC300]"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          |
        </motion.span>
      ) : null}
    </p>
  );
}
