"use client";

import { IceconnectMetroStage } from "@prisma/client";
import { motion } from "framer-motion";
import { METRO_STAGES, METRO_STAGE_LABEL } from "@/lib/iceconnect-sales-hub";

type Props = {
  current: IceconnectMetroStage;
  compact?: boolean;
  /** When set, the current step is clickable to complete / advance (caller handles API). */
  interactive?: boolean;
  disabled?: boolean;
  onActivateCurrent?: () => void;
};

export function MetroLine({
  current,
  compact,
  interactive,
  disabled,
  onActivateCurrent,
}: Props) {
  const idx = METRO_STAGES.indexOf(current);

  return (
    <div className={compact ? "w-full overflow-x-auto pb-1" : ""}>
      <div className="flex min-w-max items-center gap-0">
        {METRO_STAGES.map((stage, i) => {
          const done = i < idx;
          const active = i === idx;
          const isLast = i === METRO_STAGES.length - 1;
          const isTerminalWon = stage === IceconnectMetroStage.SUBSCRIPTION;

          const dot =
            done || (isTerminalWon && active)
              ? "bg-emerald-500 ring-2 ring-emerald-200"
              : active
                ? "bg-amber-400 ring-4 ring-amber-100 scale-110"
                : "bg-gray-300";

          const lineClass = i < idx ? "bg-emerald-400" : "bg-gray-200";

          const canClick =
            Boolean(interactive) &&
            !disabled &&
            active &&
            !isTerminalWon &&
            typeof onActivateCurrent === "function";

          const column = (
            <div className="flex flex-col items-center gap-1">
              <motion.div
                layout
                className={`h-3 w-3 rounded-full transition-all duration-300 ${dot} ${
                  canClick ? "cursor-pointer hover:scale-125" : ""
                } ${i > idx ? "opacity-70" : ""}`}
                title={METRO_STAGE_LABEL[stage]}
                whileTap={canClick ? { scale: 0.92 } : undefined}
              />
              {!compact ? (
                <span
                  className={`max-w-[5rem] text-center text-[9px] font-medium leading-tight ${
                    active ? "text-amber-800" : done ? "text-emerald-700" : "text-gray-400"
                  }`}
                >
                  {METRO_STAGE_LABEL[stage]}
                </span>
              ) : null}
            </div>
          );

          return (
            <div key={stage} className="flex items-center">
              {canClick ? (
                <button
                  type="button"
                  className="flex flex-col items-center rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-400"
                  onClick={() => onActivateCurrent?.()}
                  aria-label={`Complete stage: ${METRO_STAGE_LABEL[stage]}`}
                >
                  {column}
                </button>
              ) : (
                column
              )}
              {!isLast ? (
                <div
                  className={`mx-0.5 h-0.5 w-6 transition-colors duration-300 sm:w-10 ${lineClass}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {interactive && !disabled ? (
        <p className="mt-2 text-[10px] text-gray-500">
          Tap the highlighted step to mark it complete and move forward.
        </p>
      ) : null}
    </div>
  );
}
