export const verificationCategories = [
  {
    key: "passed",
    label: "Document Checks Passed",
    description:
      "Preliminary checks passed; authorized identity review remains required",
  },
  {
    key: "review",
    label: "Manual Review Required",
    description: "Check the customer's documents",
  },
  {
    key: "replacement",
    label: "Correction Required",
    description: "The customer needs to upload new photos",
  },
  {
    key: "approved",
    label: "Verified",
    description: "Document review is complete",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Documents did not meet requirements",
  },
] as const;
export function verificationCategory(status: string) {
  if (status === "DOCUMENT_CHECKS_PASSED") return "passed";
  if (status === "CORRECTION_REQUIRED" || status === "resubmission_required")
    return "replacement";
  if (status === "approved" || status === "rejected") return status;
  return "review";
}
export function verificationLabel(status: string) {
  if (["not_required", "not_applicable"].includes(status))
    return "Not required";
  return verificationCategories.find(
    (c) => c.key === verificationCategory(status),
  )!.label;
}

export function verificationQueueStatus(item: {
  overall_status: string;
  document_check_status?: string;
}): string {
  if (
    ["approved", "rejected", "resubmission_required"].includes(
      item.overall_status,
    )
  )
    return item.overall_status;
  return item.document_check_status && item.document_check_status !== "PENDING"
    ? item.document_check_status
    : item.overall_status;
}
