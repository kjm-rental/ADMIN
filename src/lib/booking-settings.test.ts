import { describe, expect, it } from "vitest";
import {
  getMissingBookingPolicies,
  parseOperatingHours,
} from "@/lib/booking-settings";

describe("booking settings", () => {
  it("parses weekday-specific pickup and return windows", () => {
    const form = new FormData();
    form.set("mondayEnabled", "on");
    form.set("mondayPickupOpen", "08:00");
    form.set("mondayPickupClose", "17:00");
    form.set("mondayReturnOpen", "09:00");
    form.set("mondayReturnClose", "18:00");
    expect(parseOperatingHours(form).monday).toEqual({
      enabled: true,
      pickupOpen: "08:00",
      pickupClose: "17:00",
      returnOpen: "09:00",
      returnClose: "18:00",
    });
  });

  it("reports incomplete policies without enabling defaults", () => {
    expect(getMissingBookingPolicies({})).toContain("rental-day calculation");
    expect(getMissingBookingPolicies({})).toContain("privacy notice");
  });

  it("accepts midnight as the end of the business day", () => {
    const form = new FormData();
    form.set("sundayEnabled", "on");
    form.set("sundayPickupOpen", "08:00");
    form.set("sundayPickupClose", "00:00");
    form.set("sundayReturnOpen", "08:00");
    form.set("sundayReturnClose", "00:00");
    expect(parseOperatingHours(form).sunday).toMatchObject({
      enabled: true,
      pickupClose: "00:00",
      returnClose: "00:00",
    });
  });

  it("still rejects an ordinary closing time before opening", () => {
    const form = new FormData();
    form.set("mondayEnabled", "on");
    form.set("mondayPickupOpen", "08:00");
    form.set("mondayPickupClose", "07:00");
    form.set("mondayReturnOpen", "08:00");
    form.set("mondayReturnClose", "07:00");
    expect(() => parseOperatingHours(form)).toThrow();
  });
});

it("accepts 00:00 to 00:00 as 24-hour availability", () => {
  const form = new FormData();
  form.set("mondayEnabled", "on");
  for (const field of [
    "PickupOpen",
    "PickupClose",
    "ReturnOpen",
    "ReturnClose",
  ])
    form.set(`monday${field}`, "00:00");
  expect(parseOperatingHours(form).monday).toMatchObject({
    enabled: true,
    pickupOpen: "00:00",
    pickupClose: "00:00",
  });
});
