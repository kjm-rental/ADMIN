import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("@/app/actions/motorcycle-unit-lifecycle", () => ({
  manageMotorcycleUnit: vi.fn(),
}));
import { MotorcycleUnitLifecycle } from "./motorcycle-unit-lifecycle";
const props = {
  modelId: "model",
  modelName: "Existing model",
  unit: { id: "unit", registration_plate: "7", status: "available" },
};
it("shows removal, confirmation and deactivation on the existing unit with its actual plate", () => {
  const html = renderToStaticMarkup(<MotorcycleUnitLifecycle {...props} />);
  for (const label of [
    "Remove Unit",
    "Remove Motorcycle Unit?",
    "Confirm Removal",
    "Cancel",
    "Existing model",
    "License Plate",
    ">7<",
    "cannot be undone",
    "Deactivate Unit",
  ])
    expect(html).toContain(label);
  expect(html).toContain('<button type="button"');
  expect(html).toContain('name="unitId" value="unit"');
  expect(html).toContain('name="confirmed" value="yes"');
});
it("offers reactivation for inactive units without hiding them from admin", () => {
  const html = renderToStaticMarkup(
    <MotorcycleUnitLifecycle
      {...props}
      unit={{ ...props.unit, status: "inactive" }}
    />,
  );
  expect(html).toContain("Reactivate Unit");
  expect(html).toContain("Remove Unit");
});
it("cancel closes the dialog without submitting the mutation form", () => {
  const source = readFileSync(
    "src/components/motorcycle-unit-lifecycle.tsx",
    "utf8",
  );
  expect(source).toMatch(
    /type="button"[\s\S]*?onClick=\{\(\) => dialog\.current\?\.close\(\)\}/,
  );
  expect(source).toContain("dialog.current?.showModal()");
});
