import { expect, it } from "vitest";
import {
  monthGridKeys,
  shiftCalendarPeriod,
  intersectsDay,
  dayTimeline,
  manilaEventTime,
  type CalendarReservation,
} from "./reservation-calendar";
const event = (start: string, end: string, id = "a"): CalendarReservation => ({
  id,
  reference: id,
  motorcycle: "Synthetic",
  unit: "U1",
  status: "confirmed",
  start,
  end,
});
it("lays out six complete weeks beginning on Sunday", () => {
  const keys = monthGridKeys("2026-10-12");
  expect(keys).toHaveLength(42);
  expect(keys[0]).toBe("2026-09-27");
  expect(keys.at(-1)).toBe("2026-11-07");
});
it("month navigation moves exact calendar months, including February", () => {
  expect(shiftCalendarPeriod("2026-03-31", "month", -1)).toBe("2026-02-01");
  expect(shiftCalendarPeriod("2026-12-31", "month", 1)).toBe("2027-01-01");
  expect(shiftCalendarPeriod("2026-10-12", "week", 1)).toBe("2026-10-19");
});
it("multi-day occupancy ends exclusively at Manila midnight", () => {
  const e = event("2026-10-11T16:00:00Z", "2026-10-13T16:00:00Z");
  expect(intersectsDay(e, "2026-10-12")).toBe(true);
  expect(intersectsDay(e, "2026-10-13")).toBe(true);
  expect(intersectsDay(e, "2026-10-14")).toBe(false);
});
it("separates overlapping events into lanes and reuses adjacent lanes", () => {
  const events = [
    event("2026-10-12T00:00:00Z", "2026-10-12T04:00:00Z"),
    event("2026-10-12T01:00:00Z", "2026-10-12T02:00:00Z", "b"),
    event("2026-10-12T04:00:00Z", "2026-10-12T06:00:00Z", "c"),
  ];
  const layout = dayTimeline(events, "2026-10-12");
  expect(layout.map((e) => e.lane)).toEqual([0, 1, 0]);
  expect(layout[0].lanes).toBe(2);
  expect(layout[0].top).toBeCloseTo((8 / 24) * 100);
  expect(layout[0].height).toBeCloseTo((4 / 24) * 100);
});
it("formats midnight and overnight timeline clips in Manila", () => {
  expect(manilaEventTime("2026-10-12T16:00:00Z")).toBe("00:00");
  const layout = dayTimeline(
    [event("2026-10-12T15:30:00Z", "2026-10-13T01:00:00Z")],
    "2026-10-13",
  );
  expect(layout[0].top).toBe(0);
  expect(layout[0].height).toBeCloseTo((9 / 24) * 100);
});
