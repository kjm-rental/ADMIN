import { expect, it } from "vitest";
import {
  gatewayFeeInput,
  decimalHundredths,
  estimatedGatewayFee,
} from "./gateway-fees";
const valid = {
  provider: "paymongo",
  paymentMethod: "card",
  percentage: "3.50",
  flatFeePhp: "15.00",
  notes: "Synthetic example, not an actual provider rate",
};
it("parses exact centavos and basis points", () => {
  expect(gatewayFeeInput.parse(valid)).toMatchObject({
    percentage: 350,
    flatFeePhp: 1500,
  });
  expect(decimalHundredths("0.29", 10000)).toBe(29);
});
it.each(["-1", "3.501", "", "1e2", "Infinity", " 3.5x"])(
  "rejects invalid fee input %s",
  (v) => {
    expect(gatewayFeeInput.safeParse({ ...valid, percentage: v }).success).toBe(
      false,
    );
  },
);
it("rejects rates over 100 percent and unsupported combinations", () => {
  expect(
    gatewayFeeInput.safeParse({ ...valid, percentage: "100.01" }).success,
  ).toBe(false);
  expect(
    gatewayFeeInput.safeParse({
      ...valid,
      provider: "maya",
      paymentMethod: "gcash",
    }).success,
  ).toBe(false);
});
it("requires explicit zero values rather than inventing a rate", () => {
  expect(
    gatewayFeeInput.parse({ ...valid, percentage: "0", flatFeePhp: "0" }),
  ).toMatchObject({ percentage: 0, flatFeePhp: 0 });
  expect(gatewayFeeInput.safeParse({ ...valid, flatFeePhp: "" }).success).toBe(
    false,
  );
});
it("calculates a separate internal cost and net without modifying the transaction amount", () => {
  const amount = 100000;
  expect(estimatedGatewayFee(amount, 350, 1500)).toEqual({
    feeCentavos: 5000,
    netCentavos: 95000,
  });
  expect(amount).toBe(100000);
});
it("rounds half a centavo upward", () => {
  expect(estimatedGatewayFee(100, 50, 0)).toEqual({
    feeCentavos: 1,
    netCentavos: 99,
  });
});
it("does not hide a negative estimated net", () => {
  expect(estimatedGatewayFee(100, 0, 200).netCentavos).toBe(-100);
});
it.each([NaN, Infinity, -1, 0.5, 2147483648])(
  "rejects invalid calculation amounts %s",
  (v) => expect(() => estimatedGatewayFee(v, 350, 0)).toThrow(),
);
it("handles the maximum stored values without precision overflow", () => {
  expect(estimatedGatewayFee(2147483647, 10000, 2147483647)).toEqual({
    feeCentavos: 4294967294,
    netCentavos: -2147483647,
  });
});
