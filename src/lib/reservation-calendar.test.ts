import { expect, it } from "vitest";
import {
  monthlyRentalLabel,
  calendarActivity,
  rentalActivityStyles,
  periodBars,
  calendarStatus,
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

it("keeps one continuous bar per week using exact pickup and return times", () => {
  const e = event("2026-10-12T10:00:00+08:00", "2026-10-14T15:30:00+08:00");
  const bars = periodBars(
    [e],
    [
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ],
  );
  expect(bars).toHaveLength(1);
  expect(bars[0].left).toBeCloseTo(((1 + 10 / 24) / 7) * 100);
  expect(bars[0].width).toBeCloseTo(((2 + 5.5 / 24) / 7) * 100);
  expect(bars[0].continuesBefore).toBe(false);
  expect(bars[0].continuesAfter).toBe(false);
});
it("connects cross-week rentals and excludes rentals ending at the week boundary", () => {
  const e = event("2026-10-09T12:00:00+08:00", "2026-10-20T12:00:00+08:00");
  const bars = periodBars(
    [
      e,
      event(
        "2026-10-10T08:00:00+08:00",
        "2026-10-11T00:00:00+08:00",
        "boundary",
      ),
    ],
    [
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ],
  );
  expect(bars).toHaveLength(1);
  expect(bars[0]).toMatchObject({
    left: 0,
    width: 100,
    continuesBefore: true,
    continuesAfter: true,
  });
});
it("separates overlapping period bars and reuses lanes for adjacent rentals", () => {
  const bars = periodBars(
    [
      event("2026-10-12T08:00:00+08:00", "2026-10-12T12:00:00+08:00"),
      event("2026-10-12T09:00:00+08:00", "2026-10-12T10:00:00+08:00", "b"),
      event("2026-10-12T12:00:00+08:00", "2026-10-12T15:00:00+08:00", "c"),
    ],
    ["2026-10-12"],
  );
  expect(bars.map((b) => b.lane)).toEqual([0, 1, 0]);
  expect(periodBars([], [])).toEqual([]);
});
it("distinguishes review, active, return-due, and overdue without changing backend status", () => {
  const now = Date.parse("2026-10-13T08:00:00+08:00");
  const e = event("2026-10-12T08:00:00+08:00", "2026-10-13T15:00:00+08:00");
  expect(calendarStatus(e, now)).toBe("documents_review");
  expect(calendarStatus({ ...e, verification: "approved" }, now)).toBe(
    "confirmed",
  );
  expect(calendarStatus({ ...e, status: "active" }, now)).toBe("return_due");
  expect(
    calendarStatus(
      { ...e, status: "active", end: "2026-10-13T07:00:00+08:00" },
      now,
    ),
  ).toBe("overdue");
  expect(
    calendarStatus(
      { ...e, status: "active", end: "2026-10-14T15:00:00+08:00" },
      now,
    ),
  ).toBe("active");
  expect(calendarStatus({ ...e, status: "cancelled" }, now)).toBe("cancelled");
  expect(e.status).toBe("confirmed");
});

it("shows pickup, rented, and return on separate occupied Manila dates", () => {
  const e = {
    ...event("2026-10-12T02:00:00Z", "2026-10-14T07:00:00Z"),
    status: "active",
    handoverAt: "2026-10-12T02:00:00Z",
  };
  expect(monthlyRentalLabel(e, "2026-10-12")).toBe("Picked Up");
  expect(monthlyRentalLabel(e, "2026-10-13")).toBe("Picked Up");
  expect(monthlyRentalLabel(e, "2026-10-14")).toBe("Return");
  expect(monthlyRentalLabel(e, "2026-10-15")).toBeNull();
});
it("handles week/month boundaries and a return exactly at Manila midnight", () => {
  const e = {
    ...event("2026-10-31T15:00:00Z", "2026-11-02T16:00:00Z"),
    status: "active",
    handoverAt: "2026-10-12T02:00:00Z",
  };
  expect(monthlyRentalLabel(e, "2026-10-31")).toBe("Picked Up");
  expect(monthlyRentalLabel(e, "2026-11-01")).toBe("Picked Up");
  expect(monthlyRentalLabel(e, "2026-11-02")).toBe("Return");
  expect(monthlyRentalLabel(e, "2026-11-03")).toBeNull();
});
it("combines same-day movements and never labels pending/cancelled bookings as rented", () => {
  const e = event("2026-10-12T08:00:00+08:00", "2026-10-12T17:00:00+08:00");
  expect(monthlyRentalLabel(e, "2026-10-12")).toBe("Return");
  const multi = { ...e, end: "2026-10-14T17:00:00+08:00" };
  expect(monthlyRentalLabel(multi, "2026-10-13")).toBe("Reserved");
  expect(
    monthlyRentalLabel({ ...multi, status: "pending" }, "2026-10-13"),
  ).toBe("Pending");
  expect(
    monthlyRentalLabel({ ...multi, status: "cancelled" }, "2026-10-13"),
  ).toBe("Cancelled");
  expect(
    monthlyRentalLabel({ ...multi, maintenance: true }, "2026-10-13"),
  ).toBe("Maintenance");
});

it("uses blue before handover and green only after a saved actual handover", () => {
  const e = {
    ...event("2026-10-12T02:00:00Z", "2026-10-14T07:00:00Z"),
    status: "active",
  };
  const now = Date.parse("2026-10-13T04:00:00Z");
  expect(calendarActivity(e, now, "2026-10-13")).toEqual({
    label: "Reserved",
    color: rentalActivityStyles.Reserved,
  });
  expect(
    calendarActivity(
      { ...e, handoverAt: "2026-10-13T01:00:00Z" },
      now,
      "2026-10-12",
    )?.label,
  ).toBe("Scheduled Self Pickup");
  expect(
    calendarActivity(
      { ...e, handoverAt: "2026-10-13T01:00:00Z" },
      now,
      "2026-10-13",
    ),
  ).toEqual({ label: "Picked Up", color: rentalActivityStyles["Picked Up"] });
});
it("uses orange on scheduled return dates even before handover", () => {
  const e = event("2026-10-12T02:00:00Z", "2026-10-14T07:00:00Z");
  expect(calendarActivity(e, Date.parse(e.start), "2026-10-14")).toEqual({
    label: "Scheduled Self Return",
    color: rentalActivityStyles["Scheduled Self Return"],
  });
  expect(
    calendarActivity(
      { ...e, status: "cancelled" },
      Date.parse(e.start),
      "2026-10-14",
    ),
  ).toBeNull();
});
it("applies the same styles to continuous period bars without inferring scheduled pickup", () => {
  const e = event("2026-10-12T02:00:00Z", "2026-10-14T07:00:00Z");
  const now = Date.parse("2026-10-13T02:00:00Z");
  expect(calendarActivity(e, now)?.color).toBe(rentalActivityStyles.Reserved);
  expect(
    calendarActivity({ ...e, status: "active", handoverAt: e.start }, now)
      ?.color,
  ).toBe(rentalActivityStyles["Picked Up"]);
});

it("distinguishes scheduled delivery and collection from actual handover", () => {
  const e = {
    ...event("2026-10-12T02:00:00Z", "2026-10-14T07:00:00Z"),
    delivery: { address: "Hotel delivery" },
    collection: { address: "Airport collection" },
  };
  const now = Date.parse(e.start);
  expect(calendarActivity(e, now, "2026-10-12")?.label).toBe(
    "Scheduled Delivery",
  );
  expect(calendarActivity(e, now, "2026-10-13")?.label).toBe("Reserved");
  expect(calendarActivity(e, now, "2026-10-14")?.label).toBe(
    "Scheduled Collection",
  );
  expect(
    calendarActivity(
      { ...e, status: "active", handoverAt: e.start },
      now,
      "2026-10-12",
    )?.label,
  ).toBe("Picked Up");
});
