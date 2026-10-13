import "server-only";

import { createHmac } from "node:crypto";

export function derivePinCredential(pin: string) {
  const pepper = process.env.ADMIN_PIN_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("ADMIN_PIN_PEPPER is missing or too short.");
  }
  return createHmac("sha256", pepper)
    .update(`kjm-admin-pin:${pin}`)
    .digest("hex");
}
