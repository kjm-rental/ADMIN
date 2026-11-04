import { businessTimestamp, businessDateTimeInput } from "./business-time";
export type CalendarReservation = {
  id: string;
  reference: string;
  motorcycle: string;
  unit: string;
  start: string;
  end: string;
  status: string;
  handoverAt?: string | null;
  delivery?: { address: string; areaName?: string };
  collection?: { address: string; areaName?: string };
  maintenance?: boolean;
  modelId?: string;
  customer?: string;
  imageUrl?: string;
  verification?: string;
  verificationId?: string;
  payment?: string;
};
export function addCalendarDays(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function monthGridKeys(key: string) {
  const first = key.slice(0, 7) + "-01";
  const start = addCalendarDays(
    first,
    -new Date(`${first}T12:00:00Z`).getUTCDay(),
  );
  return Array.from({ length: 42 }, (_, i) => addCalendarDays(start, i));
}
export function dayBounds(key: string) {
  return {
    start: Date.parse(businessTimestamp(`${key}T00:00`)),
    end: Date.parse(businessTimestamp(`${addCalendarDays(key, 1)}T00:00`)),
  };
}
export function intersectsDay(event: CalendarReservation, key: string) {
  const { start, end } = dayBounds(key);
  return Date.parse(event.start) < end && Date.parse(event.end) > start;
}
export function shiftCalendarPeriod(
  key: string,
  view: "month" | "week" | "day",
  delta: number,
) {
  if (view !== "month")
    return addCalendarDays(key, delta * (view === "week" ? 7 : 1));
  const d = new Date(`${key.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}
export function dayTimeline(events: CalendarReservation[], key: string) {
  const { start, end } = dayBounds(key);
  const lanes: number[] = [];
  const positioned = events
    .filter((e) => intersectsDay(e, key))
    .map((e) => ({
      ...e,
      clipStart: Math.max(start, Date.parse(e.start)),
      clipEnd: Math.min(end, Date.parse(e.end)),
    }))
    .sort((a, b) => a.clipStart - b.clipStart || b.clipEnd - a.clipEnd)
    .map((e) => {
      let lane = lanes.findIndex((finish) => finish <= e.clipStart);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = e.clipEnd;
      return {
        ...e,
        lane,
        top: ((e.clipStart - start) / 86400000) * 100,
        height: ((e.clipEnd - e.clipStart) / 86400000) * 100,
      };
    });
  return positioned.map((e) => ({ ...e, lanes: Math.max(1, lanes.length) }));
}
export function manilaEventTime(timestamp: string) {
  return businessDateTimeInput(timestamp).slice(11);
}

/** Clip a rental to a visible week using its actual Manila timestamps. */
export function periodBars(events: CalendarReservation[], days: string[]) {
  if (!days.length) return [];
  const start = dayBounds(days[0]).start;
  const end = dayBounds(days[days.length - 1]).end;
  const lanes: number[] = [];
  return events
    .filter((e) => Date.parse(e.start) < end && Date.parse(e.end) > start)
    .map((event) => ({
      event,
      start: Math.max(start, Date.parse(event.start)),
      end: Math.min(end, Date.parse(event.end)),
    }))
    .sort(
      (a, b) =>
        a.start - b.start ||
        b.end - a.end ||
        a.event.id.localeCompare(b.event.id),
    )
    .map((bar) => {
      let lane = lanes.findIndex((finish) => finish <= bar.start);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = bar.end;
      return {
        ...bar,
        lane,
        left: (100 * (bar.start - start)) / (end - start),
        width: (100 * (bar.end - bar.start)) / (end - start),
        continuesBefore: Date.parse(bar.event.start) < start,
        continuesAfter: Date.parse(bar.event.end) > end,
      };
    });
}
export function calendarStatus(event: CalendarReservation, now: number) {
  if (event.maintenance) return "maintenance";
  if (event.status === "active") {
    if (Date.parse(event.end) < now) return "overdue";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
    if (
      intersectsDay(
        {
          ...event,
          start: event.end,
          end: new Date(Date.parse(event.end) + 1).toISOString(),
        },
        today,
      )
    )
      return "return_due";
    return "active";
  }
  if (
    ["pending", "submitted", "confirmed"].includes(event.status) &&
    event.verification !== "approved"
  )
    return "documents_review";
  return event.status === "submitted" ? "pending" : event.status;
}

/** Presentation only: activity on an occupied Manila date, with an exclusive end. */
export function monthlyRentalLabel(event: CalendarReservation, day: string) {
  if (!intersectsDay(event, day)) return null;
  if (event.maintenance) return "Maintenance";
  if (event.status === "cancelled") return "Cancelled";
  if (["pending", "submitted"].includes(event.status)) return "Pending";
  if (["rejected", "expired"].includes(event.status))
    return event.status === "rejected" ? "Rejected" : "Expired";
  const { start, end } = dayBounds(day);
  const returns = Date.parse(event.end) > start && Date.parse(event.end) <= end;
  if (returns) return "Return";
  const handedOver =
    !!event.handoverAt &&
    Number.isFinite(Date.parse(event.handoverAt)) &&
    Date.parse(event.handoverAt) < end &&
    ["active", "completed"].includes(event.status);
  return handedOver ? "Picked Up" : "Reserved";
}

export const rentalActivityStyles = {
  "Scheduled Self Pickup": "border-sky-300 bg-sky-50 text-sky-900",
  "Scheduled Delivery": "border-purple-300 bg-purple-50 text-purple-900",
  "Scheduled Collection": "border-pink-300 bg-pink-50 text-pink-900",
  "Picked Up": "border-emerald-300 bg-emerald-50 text-emerald-900",
  Reserved: "border-blue-300 bg-blue-50 text-blue-900",
  "Scheduled Self Return": "border-orange-300 bg-orange-50 text-orange-900",
} as const;
export function calendarActivity(
  event: CalendarReservation,
  now: number,
  day?: string,
) {
  const key =
    day ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  let label = monthlyRentalLabel(event, key);
  if (label === "Return")
    label = event.collection ? "Scheduled Collection" : "Scheduled Self Return";
  if (label === "Reserved") {
    const bounds = dayBounds(key);
    if (
      Date.parse(event.start) >= bounds.start &&
      Date.parse(event.start) < bounds.end
    )
      label = event.delivery ? "Scheduled Delivery" : "Scheduled Self Pickup";
  }
  if (label && label in rentalActivityStyles)
    return {
      label,
      color: rentalActivityStyles[label as keyof typeof rentalActivityStyles],
    };
  // Continuous period bars may be outside today's date. Never infer handover from scheduled pickup.
  if (!day && ["confirmed", "active", "completed"].includes(event.status)) {
    const pickedUp =
      !!event.handoverAt &&
      Date.parse(event.handoverAt) <= now &&
      ["active", "completed"].includes(event.status);
    const activity = pickedUp ? "Picked Up" : "Reserved";
    return { label: activity, color: rentalActivityStyles[activity] };
  }
  return null;
}
