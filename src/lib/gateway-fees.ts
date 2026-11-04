import { z } from "zod";
export const gatewayLabels = { paymongo: "PayMongo", maya: "Maya" } as const;
export const paymentMethodLabels = {
  card: "Visa / Mastercard",
  gcash: "GCash",
  maya: "Maya wallet",
} as const;
const maxCentavos = 2147483647;
export function decimalHundredths(value: string, maximum: number) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error(
      "Use a non-negative value with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > maximum)
    throw new Error("The value exceeds the supported range.");
  return result;
}
export const gatewayFeeInput = z
  .object({
    provider: z.enum(["paymongo", "maya"]),
    paymentMethod: z.enum(["card", "gcash", "maya"]),
    percentage: z
      .string()
      .trim()
      .transform((s, ctx) => {
        try {
          return decimalHundredths(s, 10000);
        } catch {
          ctx.addIssue({
            code: "custom",
            message:
              "Enter a percentage from 0 to 100, with at most two decimal places.",
          });
          return z.NEVER;
        }
      }),
    flatFeePhp: z
      .string()
      .trim()
      .transform((s, ctx) => {
        try {
          return decimalHundredths(s, maxCentavos);
        } catch {
          ctx.addIssue({
            code: "custom",
            message:
              "Enter a valid fixed PHP fee with at most two decimal places.",
          });
          return z.NEVER;
        }
      }),
    notes: z.string().trim().max(1000),
  })
  .refine((v) => v.provider !== "maya" || v.paymentMethod !== "gcash", {
    message: "Choose card or Maya wallet for a Maya profile.",
    path: ["paymentMethod"],
  });
export type GatewayFee = {
  id: string;
  provider: keyof typeof gatewayLabels;
  payment_method: keyof typeof paymentMethodLabels;
  percentage_basis_points: number;
  flat_fee_centavos: number;
  notes: string;
  updated_at: string;
  updated_by: string;
};
export function estimatedGatewayFee(
  amount: number,
  basisPoints: number,
  fixed: number,
) {
  for (const [value, max] of [
    [amount, maxCentavos],
    [basisPoints, 10000],
    [fixed, maxCentavos],
  ])
    if (!Number.isSafeInteger(value) || value < 0 || value > max)
      throw new Error("Invalid fee calculation input.");
  const fee = Math.floor((amount * basisPoints + 5000) / 10000) + fixed;
  return { feeCentavos: fee, netCentavos: amount - fee };
}
export function feePHP(cents: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);
}
