vi.mock("next/server", () => ({ connection: async () => undefined }));
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/app/actions/auth", () => ({ changePin: vi.fn(), signOut: vi.fn() }));
import Overview from "./page";
import Bookings from "./bookings/page";
import Calendar from "./calendar/page";
import Verification from "./verifications/page";
import Fleet from "./fleet/page";
import Extras from "./extras/page";
import Customers from "./customers/page";
import Finance from "./finance/page";
import Reports from "./reports/page";
import Settings from "./settings/page";
import BookingDetails from "./bookings/[id]/page";
import FleetDetails from "./fleet/[id]/page";
beforeEach(() => {
  const from = () => {
    const result = {
      data: null,
      error: { message: "Synthetic query failure" },
    };
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      is: () => q,
      lt: () => q,
      gt: () => q,
      gte: () => q,
      order: () => q,
      limit: () => q,
      range: () => q,
      maybeSingle: () => q,
      single: () => q,
      then: (resolve: (value: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return q;
  };
  mocks.requireAdmin.mockResolvedValue({
    supabase: { from },
    user: { id: "synthetic-admin" },
  });
});
it.each([
  ["Overview", () => Overview()],
  ["Bookings", () => Bookings({ searchParams: Promise.resolve({}) })],
  ["Calendar", () => Calendar({ searchParams: Promise.resolve({}) })],
  ["Verification", () => Verification({ searchParams: Promise.resolve({}) })],
  ["Fleet", () => Fleet({ searchParams: Promise.resolve({}) })],
  ["Extras", () => Extras({ searchParams: Promise.resolve({}) })],
  ["Customers", () => Customers()],
  ["Finance", () => Finance({ searchParams: Promise.resolve({}) })],
  ["Reports", () => Reports()],
  ["Settings", () => Settings({ searchParams: Promise.resolve({}) })],
  [
    "Booking details",
    () =>
      BookingDetails({
        params: Promise.resolve({ id: "synthetic" }),
        searchParams: Promise.resolve({}),
      }),
  ],
  [
    "Fleet details",
    () =>
      FleetDetails({
        params: Promise.resolve({ id: "synthetic" }),
        searchParams: Promise.resolve({}),
      }),
  ],
] as const)(
  "%s propagates failed queries instead of showing empty records",
  async (_name, call) => {
    await expect(call()).rejects.toThrow(/failure|could not be loaded/);
  },
);
