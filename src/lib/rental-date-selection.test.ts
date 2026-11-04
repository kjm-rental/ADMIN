import { expect, it } from "vitest";
import {
  rentalReturnAfter,
  rentalTime24,
  rentalTimeParts,
} from "./rental-date-selection";
it("sets return across months and years without changing Manila pickup time", () => {
  expect(rentalReturnAfter("2030-01-31T23:45", 1)).toBe("2030-02-01T23:45");
  expect(rentalReturnAfter("2030-12-31T00:00", 7)).toBe("2031-01-07T00:00");
  expect(rentalReturnAfter("", 1)).toBe("");
});
it("handles noon and midnight correctly", () => {
  expect(rentalTime24("12", "00", "AM")).toBe("00:00");
  expect(rentalTime24("12", "30", "PM")).toBe("12:30");
  expect(rentalTime24("01", "45", "PM")).toBe("13:45");
  expect(rentalTimeParts("00:00")).toEqual({
    hour: "12",
    minute: "00",
    period: "AM",
  });
  expect(rentalTimeParts("13:17")).toEqual({
    hour: "01",
    minute: "17",
    period: "PM",
  });
});
