import { businessTimestamp, businessDateTimeInput } from "./business-time";
export type CalendarReservation = {
  id: string;
  reference: string;
  motorcycle: string;
  unit: string;
  start: string;
  end: string;
  status: string;
  maintenance?: boolean;
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
