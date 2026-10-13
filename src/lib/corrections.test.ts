import { describe, expect, it } from "vitest";
import { businessTimestamp, businessDateTimeInput } from "./business-time";
import { matchesBookingSearch } from "./booking-search";
import { checkedQueries } from "./query-results";
describe("Philippine business timestamps", () => {
  it.each(["UTC", "Asia/Manila", "America/New_York"])(
    "is independent of host timezone %s",
    (timezone) => {
      const original = process.env.TZ;
      try {
        process.env.TZ = timezone;
        expect(businessTimestamp("2031-06-01T00:01")).toBe(
          "2031-05-31T16:01:00.000Z",
        );
        expect(businessTimestamp("2031-06-01T23:59")).toBe(
          "2031-06-01T15:59:00.000Z",
        );
        expect(businessTimestamp("2032-03-01T00:00")).toBe(
          "2032-02-29T16:00:00.000Z",
        );
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    },
  );
  it.each(["2031-06-01T04:00:00Z", "2031-06-01T12:00:00+08:00"])(
    "does not double convert %s",
    (value) => {
      expect(businessTimestamp(value)).toBe("2031-06-01T04:00:00.000Z");
    },
  );
  it.each([
    "2031-06-01",
    "2031-02-29T12:00",
    "2031-13-01T12:00",
    "2031-06-01T24:00",
    "2031-06-01T12:60",
    "not-a-date",
  ])("rejects invalid or date-only input %s", (value) =>
    expect(() => businessTimestamp(value)).toThrow(),
  );
});
describe("booking search plain text", () => {
  it.each(["KJM-001", "ALICE", "nmax"])("finds real fields %s", (query) =>
    expect(matchesBookingSearch(query, "KJM-001", "Alice", "NMAX")).toBe(true),
  );
  it.each(["span", "className", "admin-badge", "b.is_test", "Test"])(
    "does not match injected markup %s",
    (query) =>
      expect(matchesBookingSearch(query, "KJM-001", "Alice", "NMAX")).toBe(
        false,
      ),
  );
  it("treats customer markup as literal text", () =>
    expect(
      matchesBookingSearch("<script>", "001", "<script>alert(1)</script>"),
    ).toBe(true));
});
describe("query errors versus empty data", () => {
  it("preserves successful empty data", () => {
    const results = [
      { data: [], error: null },
      { data: null, error: null },
    ];
    expect(checkedQueries(results)).toBe(results);
  });
  it.each([0, 1, 2])(
    "rejects a failed primary or relationship query at %i",
    (index) => {
      const results = [0, 1, 2].map((i) => ({
        data: [],
        error: i === index ? { message: "synthetic failure" } : null,
      }));
      expect(() => checkedQueries(results)).toThrow("could not be loaded");
    },
  );
});

it("formats an existing UTC timestamp in Manila and roundtrips once", () => {
  expect(businessDateTimeInput("2031-05-31T16:01:00Z")).toBe(
    "2031-06-01T00:01",
  );
  expect(businessTimestamp(businessDateTimeInput("2031-05-31T16:01:00Z"))).toBe(
    "2031-05-31T16:01:00.000Z",
  );
});
