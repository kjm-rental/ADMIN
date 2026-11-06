import { createHash } from "node:crypto";
import terms20261012 from "./terms/2026-10-12.json";
export class ContractUnavailable extends Error {}
const versions: Record<string, typeof terms20261012> = {
  "2026-10-12": terms20261012,
};
/** Never substitute today's agreement for the version accepted with a booking. */
export function contractTerms(
  version: string,
  recordedHash: string,
  acceptanceHash?: string,
) {
  const terms = versions[version];
  if (
    !terms ||
    terms.sourceSha256 !== recordedHash ||
    (acceptanceHash !== undefined && acceptanceHash !== recordedHash) ||
    createHash("sha256").update(terms.sourceText).digest("hex") !== recordedHash
  )
    throw new ContractUnavailable(
      "This booking's original terms could not be verified. Please contact KJM before issuing a contract copy.",
    );
  return terms;
}
