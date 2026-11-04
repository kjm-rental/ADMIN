import { z } from "zod";
export const inspectionAccessories = [
  "Motorcycle key",
  "Helmet 1",
  "Helmet 2",
  "Raincoat 1",
  "Raincoat 2",
  "Phone holder",
  "Top box",
  "Motorcycle documents",
] as const;
export const compactInspectionSchema = z
  .object({
    bookingId: z.uuid(),
    idempotencyKey: z.uuid(),
    kind: z.enum(["handover", "return"]),
    odometerKm: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().int().nonnegative().max(2147483647),
    ),
    fuelPercent: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce
        .number()
        .refine(
          (v) => [0, 25, 50, 75, 100].includes(v),
          "Select a fuel level.",
        ),
    ),
    condition: z.enum(["good", "damage"]),
    damage: z.string().trim().max(1000),
    notes: z.string().trim().max(800),
    extraAccessories: z.string().trim().max(500),
    accessories: z.array(z.enum(inspectionAccessories)),
    accessoriesChecked: z.literal("on"),
    identityChecked: z.string().optional(),
    occurredAt: z.string().max(40),
  })
  .superRefine((d, c) => {
    if (d.condition === "damage" && !d.damage)
      c.addIssue({
        code: "custom",
        path: ["damage"],
        message: "Describe the damage or safety concern.",
      });
    if (d.kind === "handover" && d.identityChecked !== "on")
      c.addIssue({
        code: "custom",
        path: ["identityChecked"],
        message: "Recheck identity and driving eligibility.",
      });
  });
export function compactInspectionValues(form: FormData) {
  return compactInspectionSchema.parse({
    ...Object.fromEntries(form),
    accessories: form.getAll("accessories"),
  });
}
