import { expect, it } from "vitest";
import {
  rentalCalendarDays,
  rentalCalendarLabel,
  shiftRentalMonth,
} from "./rental-calendar";
it("builds a stable Monday-first six-week calendar with adjacent dates", () => {
  const days = rentalCalendarDays("2026-10");
  expect(days).toHaveLength(42);
  expect(days[0]).toBe("2026-09-28");
  expect(days[41]).toBe("2026-11-08");
  expect(new Set(days).size).toBe(42);
});
it("handles leap days and month/year navigation", () => {
  expect(rentalCalendarDays("2028-02")).toContain("2028-02-29");
  expect(shiftRentalMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftRentalMonth("2027-01", -1)).toBe("2026-12");
});
it("formats the selected date explicitly without browser date ordering", () => {
  expect(rentalCalendarLabel("2026-10-30")).toBe("30 Oct 2026");
});
