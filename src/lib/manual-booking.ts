import { z } from "zod";
import { businessTimestamp } from "./business-time";

export const adjustmentSchema = z
  .object({
    kind: z.enum(["none", "fixed", "percentage", "agreed"]),
    value: z.number().finite().nonnegative().max(10000000),
    reason: z.string().trim().max(500),
  })
  .superRefine((a, ctx) => {
    if (a.kind !== "none" && a.reason.length < 5)
      ctx.addIssue({
        code: "custom",
        message: "Give a short reason for the price adjustment.",
      });
    if (
      a.kind === "percentage" &&
      (a.value > 100 ||
        Math.abs(a.value * 100 - Math.round(a.value * 100)) > 0.000001)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Enter a percentage from 0 to 100 with at most two decimal places.",
      });
    if (a.kind !== "percentage" && !Number.isInteger(a.value))
      ctx.addIssue({
        code: "custom",
        message: "Enter whole pesos, matching the existing rental ledger.",
      });
  });
export function adjustedRental(
  standard: number,
  adjustment: z.infer<typeof adjustmentSchema>,
) {
  const a = adjustmentSchema.parse(adjustment);
  const final =
    a.kind === "none"
      ? standard
      : a.kind === "agreed"
        ? a.value
        : a.kind === "fixed"
          ? standard - a.value
          : Math.round(
              (standard * (10000 - Math.round(a.value * 100))) / 10000,
            );
  if (
    !Number.isSafeInteger(Math.round(standard * 100)) ||
    standard < 0 ||
    final < 0 ||
    !Number.isSafeInteger(Math.round(final * 100))
  )
    throw Error(
      "The final rental price cannot be negative or outside the supported range.",
    );
  return {
    standard,
    adjustment: Math.round((final - standard) * 100) / 100,
    final,
  };
}
const legSchema = z.object({
  areaId: z.uuid(),
  address: z.string().trim().min(5).max(500),
  instructions: z.string().trim().max(1000).default(""),
});
export const manualBookingSchema = z
  .object({
    requestId: z.uuid(),
    bookingId: z.uuid().nullable().default(null),
    revision: z.number().int().nonnegative().default(0),
    customerId: z.uuid().nullable().default(null),
    fullName: z.string().trim().min(2).max(160),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s()-]{6,24}$/, "Enter a valid mobile number."),
    email: z.union([z.literal(""), z.email().max(254)]).default(""),
    customerType: z.enum(["philippine_resident", "international_visitor"]),
    source: z.enum(["whatsapp", "phone", "walk_in", "other"]),
    modelId: z.uuid(),
    unitId: z.uuid(),
    selectedColor: z.string().trim().max(100).nullable().optional(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    services: z.object({
      delivery: legSchema.nullable(),
      collection: legSchema.nullable(),
    }),
    extras: z
      .array(
        z.object({
          id: z.uuid(),
          quantity: z.number().int().positive().max(100),
        }),
      )
      .max(20),
    adjustment: adjustmentSchema,
    notes: z.string().trim().max(2000),
    action: z.enum(["pending", "confirmed"]),
    confirmationReason: z.string().trim().max(500),
    expectedTotal: z.number().nonnegative().multipleOf(0.01).optional(),
    quoteToken: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.action === "confirmed" && d.confirmationReason.length < 5)
      ctx.addIssue({
        code: "custom",
        message:
          "Record why this reservation can be confirmed before document review.",
      });
    if (new Set(d.extras.map((x) => x.id)).size !== d.extras.length)
      ctx.addIssue({
        code: "custom",
        message: "Select each accessory only once.",
      });
    try {
      if (
        Date.parse(businessTimestamp(d.endAt)) -
          Date.parse(businessTimestamp(d.startAt)) <
        86400000
      )
        ctx.addIssue({
          code: "custom",
          message: "Minimum rental duration is 24 hours.",
        });
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter valid rental dates and times.",
      });
    }
  });
export type ManualBookingInput = z.infer<typeof manualBookingSchema>;
export type ManualQuote = {
  base: number;
  extras: number;
  services: number;
  standard: number;
  adjustment: number;
  final: number;
  deposit: number;
  pricing: unknown;
  delivery: Record<string, unknown>;
  units: {
    id: string;
    code: string;
    plate: string | null;
    color?: string | null;
  }[];
  token: string;
  policyVersion: string;
};
export type ManualCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  customer_type: string | null;
};
export type ManualOptions = {
  models: {
    id: string;
    display_name: string;
    daily_rate_php: number;
    image: string | null;
  }[];
  extras: {
    id: string;
    name: string;
    price_php: number;
    pricing_model: string;
    max_per_booking: number;
    compatible_model_ids: string[];
  }[];
  delivery: {
    enabled: boolean;
    cash_enabled: boolean;
    delivery_open: string;
    delivery_close: string;
    collection_open: string;
    collection_close: string;
    areas: {
      id: string;
      name: string;
      delivery_php: number;
      collection_php: number;
    }[];
  };
  ready: boolean;
};
