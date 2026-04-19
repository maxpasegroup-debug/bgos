/** UTC calendar day YYYY-MM-DD (stable for streak math). */
export function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addUtcDays(day: string, delta: number): string {
  const x = new Date(`${day}T12:00:00.000Z`);
  x.setUTCDate(x.getUTCDate() + delta);
  return utcDayString(x);
}

/**
 * Counts consecutive calendar days present in `days`, anchored at the most recent
 * activity day (today preferred, else yesterday). Returns 0 if neither applies.
 */
export function consecutiveDayStreak(days: Set<string>): number {
  const today = utcDayString(new Date());
  let anchor = today;
  if (!days.has(today)) {
    const y = addUtcDays(today, -1);
    if (!days.has(y)) return 0;
    anchor = y;
  }
  let n = 0;
  let d = anchor;
  while (days.has(d)) {
    n++;
    d = addUtcDays(d, -1);
  }
  return n;
}
