export const verificationAttestation =
  "I have inspected all current required documents and confirm readability and completeness, document authenticity and customer ownership, matching identity information, validity and expiration, and applicable motorcycle license categories, rental eligibility and international driving requirements.";
export function documentReviewType(kind: string) {
  if (["passport", "government_id"].includes(kind)) return "identity";
  if (["drivers_license_front", "drivers_license_back"].includes(kind))
    return "license";
  if (kind === "international_driving_permit") return "international";
  if (kind === "supporting_document") return "entitlement";
  throw new Error("Unsupported document type.");
}
export function documentLabel(kind: string) {
  return (
    (
      {
        passport: "Passport",
        government_id: "National ID",
        drivers_license_front: "Driver’s license",
        drivers_license_back: "License back",
        international_driving_permit: "International permit",
        supporting_document: "Supporting document",
      } as Record<string, string>
    )[kind] ?? kind.replaceAll("_", " ")
  );
}
