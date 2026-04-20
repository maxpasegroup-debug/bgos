/**
 * 7-day Nexa BDE onboarding plan (copy + task keys). Progress is stored in DB; this is the source of truth for structure.
 */

export type BdeOnboardingTaskDef = {
  key: string;
  label: string;
};

export type BdeOnboardingDayDef = {
  day: number;
  title: string;
  mentor_message: string;
  tasks: BdeOnboardingTaskDef[];
};

export const BDE_ONBOARDING_DAYS: BdeOnboardingDayDef[] = [
  {
    day: 1,
    title: "Introduction & first leads",
    mentor_message: "Let's start simple. Read the mission below and add 2 companies today.",
    tasks: [
      { key: "d1_intro", label: "Read today's Nexa mission banner" },
      { key: "d1_lead_1", label: "Add your first company as a prospect" },
      { key: "d1_lead_2", label: "Add a second company" },
    ],
  },
  {
    day: 2,
    title: "Volume + calling",
    mentor_message: "You're on Day 2. Push 3 new leads and log at least one call.",
    tasks: [
      { key: "d2_lead_1", label: "Add your first new prospect today" },
      { key: "d2_lead_2", label: "Add your second prospect" },
      { key: "d2_lead_3", label: "Add your third prospect" },
      { key: "d2_calling", label: "Log a call (use Log a call)" },
    ],
  },
  {
    day: 3,
    title: "Push five",
    mentor_message: "You're getting better. Let's push 5 today.",
    tasks: [
      { key: "d3_l1", label: "Prospect 1 of 5" },
      { key: "d3_l2", label: "Prospect 2 of 5" },
      { key: "d3_l3", label: "Prospect 3 of 5" },
      { key: "d3_l4", label: "Prospect 4 of 5" },
      { key: "d3_l5", label: "Prospect 5 of 5" },
    ],
  },
  {
    day: 4,
    title: "Follow-up rhythm",
    mentor_message: "Follow up beats cold every time. Work your pipeline today.",
    tasks: [
      { key: "d4_follow_1", label: "Message or call one existing prospect" },
      { key: "d4_follow_2", label: "Second follow-up touch" },
      { key: "d4_pipeline", label: "Move one prospect to Contacted or Trial" },
    ],
  },
  {
    day: 5,
    title: "Trial push",
    mentor_message: "Try converting them into trial.",
    tasks: [
      { key: "d5_pitch", label: "Run a trial / next-step pitch with one prospect" },
      { key: "d5_docs", label: "Share trial or signup details (WhatsApp/email)" },
      { key: "d5_commit", label: "Log outcome: trial started or follow-up booked" },
    ],
  },
  {
    day: 6,
    title: "Consistency",
    mentor_message: "Consistency beats intensity. Finish today's mission and protect your streak.",
    tasks: [
      { key: "d6_mission", label: "Complete today's prospect target in Nexa mission" },
      { key: "d6_calls", label: "Log at least 2 calls" },
    ],
  },
  {
    day: 7,
    title: "Performance summary",
    mentor_message: "Last day of bootcamp — review your week and plan the next.",
    tasks: [
      { key: "d7_review", label: "Skim Pipeline & wallet: note wins" },
      { key: "d7_plan", label: "Write 3 focus actions for next week" },
      { key: "d7_done", label: "Confirm you're ready to run Nexa solo" },
    ],
  },
];

export function getOnboardingDayDef(day: number): BdeOnboardingDayDef | undefined {
  return BDE_ONBOARDING_DAYS.find((d) => d.day === day);
}

export const BDE_ONBOARDING_TOTAL_DAYS = 7;

/** Prospect count required today for mission completion (0 = task-only day). */
export const ONBOARDING_DAY_LEAD_TARGET: Record<number, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 0,
  5: 0,
  6: 5,
  7: 0,
};
