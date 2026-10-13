import { expect, it } from "vitest";
import { calendarPeriod } from "./calendar-period";
it.each(["UTC", "Asia/Manila", "America/New_York"])(
  "calendar boundaries use Manila on %s hosts",
  (timezone) => {
    const original = process.env.TZ;
    try {
      process.env.TZ = timezone;
      const day = calendarPeriod("2031-06-01", "day");
      expect(day.start.toISOString()).toBe("2031-05-31T16:00:00.000Z");
      expect(day.end.toISOString()).toBe("2031-06-01T16:00:00.000Z");
      expect(day.shift(-1)).toBe("2031-05-31");
      const month = calendarPeriod("2031-06-18", "month");
      expect(month.start.toISOString()).toBe("2031-05-31T16:00:00.000Z");
      expect(month.end.toISOString()).toBe("2031-06-30T16:00:00.000Z");
      const today = calendarPeriod(
        undefined,
        "day",
        new Date("2031-05-31T16:01:00Z"),
      );
      expect(today.key).toBe("2031-06-01");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  },
);
