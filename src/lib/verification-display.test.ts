import { expect, it } from "vitest";
import {
  verificationCategory,
  verificationLabel,
} from "./verification-display";
it("groups pending, submitted and in-progress reviews in Needs Review", () => {
  for (const status of ["pending", "submitted", "under_review"]) {
    expect(verificationCategory(status)).toBe("review");
    expect(verificationLabel(status)).toBe("Manual Review Required");
  }
});
it("keeps replacement requests separate from rejections and approvals", () => {
  expect(verificationCategory("resubmission_required")).toBe("replacement");
  expect(verificationLabel("resubmission_required")).toBe(
    "Correction Required",
  );
  expect(verificationCategory("approved")).toBe("approved");
  expect(verificationCategory("rejected")).toBe("rejected");
  expect(verificationLabel("not_required")).toBe("Not required");
});

it("keeps preliminary document success separate from authorized verification", () => {
  expect(verificationCategory("DOCUMENT_CHECKS_PASSED")).toBe("passed");
  expect(verificationLabel("DOCUMENT_CHECKS_PASSED")).toBe(
    "Document Checks Passed",
  );
  expect(verificationLabel("approved")).toBe("Verified");
  expect(verificationCategory("CORRECTION_REQUIRED")).toBe("replacement");
});
