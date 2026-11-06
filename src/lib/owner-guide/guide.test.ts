import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import {
  ownerTourSteps,
  parseOwnerTourProgress,
  ownerTourStorageKey,
  OWNER_TOUR_VERSION,
} from "./tour";
import { guideGroups, ownerGuideTopics } from "./topics";
it("rejects corrupt/unversioned browser state and clamps valid saved progress", () => {
  for (const value of [
    null,
    "broken",
    "{}",
    JSON.stringify({ version: 999, seen: true, completed: true, step: 2 }),
  ])
    expect(parseOwnerTourProgress(value)).toEqual({
      seen: false,
      completed: false,
      step: 0,
    });
  expect(
    parseOwnerTourProgress(
      JSON.stringify({
        version: OWNER_TOUR_VERSION,
        seen: true,
        completed: false,
        step: 999,
      }),
    ),
  ).toEqual({ seen: true, completed: false, step: ownerTourSteps.length - 1 });
  expect(
    parseOwnerTourProgress(
      JSON.stringify({
        version: OWNER_TOUR_VERSION,
        seen: true,
        completed: true,
        step: -1,
      }),
    ),
  ).toEqual({ seen: true, completed: true, step: 0 });
});
it("keeps different administrators' local progress separate", () =>
  expect(ownerTourStorageKey("owner-a")).not.toBe(
    ownerTourStorageKey("owner-b"),
  ));
it("links every tour step to a real guide topic and an existing view-only page", () => {
  const ids = new Set(ownerGuideTopics.map((t) => t.id));
  expect(ids.size).toBe(ownerGuideTopics.length);
  expect(new Set(ownerTourSteps.map((t) => t.id)).size).toBe(
    ownerTourSteps.length,
  );
  for (const entry of [...ownerTourSteps, ...ownerGuideTopics]) {
    expect(entry.href.startsWith("/dashboard")).toBe(true);
    expect(existsSync(`src/app${entry.href.split(/[?#]/)[0]}/page.tsx`)).toBe(
      true,
    );
  }
  for (const step of ownerTourSteps) expect(ids.has(step.topic)).toBe(true);
});
it("covers every main dashboard section and the complete rental lifecycle", () => {
  const routes = new Set(ownerGuideTopics.map((t) => t.href.split("?")[0]));
  for (const route of [
    "/dashboard",
    "/dashboard/bookings",
    "/dashboard/bookings/new",
    "/dashboard/calendar",
    "/dashboard/verifications",
    "/dashboard/fleet",
    "/dashboard/extras",
    "/dashboard/customers",
    "/dashboard/finance",
    "/dashboard/deposits",
    "/dashboard/reports",
    "/dashboard/settings",
  ])
    expect(routes.has(route)).toBe(true);
  for (const id of [
    "verification",
    "rental-payments",
    "deposit-workflow",
    "handover",
    "return",
    "contracts",
    "statuses",
    "hours",
    "notifications",
    "troubleshooting",
  ])
    expect(ownerGuideTopics.some((t) => t.id === id)).toBe(true);
  for (const topic of ownerGuideTopics) {
    expect(guideGroups as readonly string[]).toContain(topic.group);
    expect(topic.steps.length).toBeGreaterThanOrEqual(2);
  }
});
it("does not describe reports as having a date filter or imply sent means inbox delivery", () => {
  const report = ownerGuideTopics.find((t) => t.id === "reports")!;
  expect(report.summary).toContain("overall");
  expect(report.notes?.join(" ")).toContain("all-time, read-only");
  expect(
    ownerGuideTopics.find((t) => t.id === "notifications")?.notes?.join(" "),
  ).toContain("not a guarantee of inbox placement");
});
