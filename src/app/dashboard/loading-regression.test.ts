import { beforeEach, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ connected: false }));
vi.mock("next/server", () => ({
  connection: async () => {
    state.connected = true;
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => {
    if (!state.connected)
      throw new Error("Authenticated clock/session access before request time");
    return { user: { email: "reviewer@example.invalid" } };
  },
}));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/services/operations-view", () => ({
  getOperationsView: async () => ({
    bookings: [],
    payments: [],
    units: [],
    verifications: [],
    holds: [],
  }),
}));
vi.mock("@/services/security-deposits", () => ({
  getSecurityDepositView: async () => ({
    available: true,
    requirements: [],
    events: [],
    inspections: [],
  }),
}));
import Layout from "./layout";
import Overview from "./page";
beforeEach(() => {
  state.connected = false;
});
it("defers authenticated layout work until request time", async () => {
  const result = await Layout({ children: createElement("p", null, "Ready") });
  expect(renderToStaticMarkup(result)).toContain("Ready");
});
it("renders real zero-record states instead of a perpetual loading screen", async () => {
  const page = await Overview();
  expect(state.connected).toBe(true);
  const html = renderToStaticMarkup(page);
  expect(html).toContain("Your day, at a glance");
  expect(html).toContain("Total bookings");
  expect(html).toContain("Confirmed bookings");
  expect(html).not.toContain("animate-pulse");
});
