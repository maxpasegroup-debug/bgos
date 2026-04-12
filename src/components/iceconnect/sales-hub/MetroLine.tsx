"use client";

import { IceconnectMetroStage } from "@prisma/client";
import { METRO_STAGES, METRO_STAGE_LABEL } from "@/lib/iceconnect-sales-hub";

type Props = {
  current: IceconnectMetroStage;
  compact?: boolean;
};

export function MetroLine({ current, compact }: Props) {
  const idx = METRO_STAGES.indexOf(current);

  return (
    <div className={compact ? "w-full overflow-x-auto pb-1" : ""}>
      <div className="flex min-w-max items-center gap-0">
        {METRO_STAGES.map((stage, i) => {
          const done = i < idx;
          const active = i === idx;
          const pending = i > idx;
          const isLast = i === METRO_STAGES.length - 1;

          const dot =
            done || (stage === IceconnectMetroStage.SUBSCRIPTION && active)
              ? "bg-emerald-500 ring-2 ring-emerald-200"
              : active
                ? "bg-amber-400 ring-4 ring-amber-100 scale-110"
                : "bg-gray-300";

          return (
            <div key={stage} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-3 w-3 rounded-full transition-all duration-300 ${dot}`}
                  title={METRO_STAGE_LABEL[stage]}
                />
                {!compact ? (
                  <span
                    className={`max-w-[4.5rem] text-center text-[9px] font-medium leading-tight ${
                      active ? "text-amber-800" : done ? "text-emerald-700" : "text-gray-400"
                    }`}
                  >
                    {METRO_STAGE_LABEL[stage]}
                  </span>
                ) : null}
              </div>
              {!isLast ? (
                <div
                  className={`mx-0.5 h-0.5 w-6 sm:w-10 ${i < idx ? "bg-emerald-400" : "bg-gray-200"}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
