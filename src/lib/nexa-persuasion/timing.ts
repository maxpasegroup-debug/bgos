export type NexaTimeBand = "morning" | "afternoon" | "evening";

/** India business day for copy rhythm (planning / push / review). */
export function getTimeBandIst(): NexaTimeBand {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";
  const h = Number.parseInt(hourStr, 10);
  if (Number.isNaN(h)) return "afternoon";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function timingHint(band: NexaTimeBand): string {
  if (band === "morning") return "Plan your three priority actions before noon.";
  if (band === "afternoon") return "Execute. Move pipeline stages before end of day.";
  return "Review outcomes. Set tomorrow’s first call list.";
}
