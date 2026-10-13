import { businessTimestamp } from "./business-time";
const dateString = (date: Date) => date.toISOString().slice(0, 10);
export function calendarPeriod(
  date: string | undefined,
  view: "day" | "week" | "month",
  now = new Date(),
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const key = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  businessTimestamp(`${key}T00:00`); // Validate a date-only calendar key without treating it as an instant.
  const base = new Date(`${key}T00:00:00Z`); // UTC calendar arithmetic, never host-local setters.
  const start = new Date(base),
    end = new Date(base);
  if (view === "day") end.setUTCDate(end.getUTCDate() + 1);
  else if (view === "week") {
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    start.setUTCDate(1);
    end.setUTCMonth(start.getUTCMonth() + 1, 1);
  }
  return {
    key,
    loadedAt: now,
    start: new Date(businessTimestamp(`${dateString(start)}T00:00`)),
    end: new Date(businessTimestamp(`${dateString(end)}T00:00`)),
    shift(days: number) {
      const shifted = new Date(base);
      shifted.setUTCDate(shifted.getUTCDate() + days);
      return dateString(shifted);
    },
  };
}
