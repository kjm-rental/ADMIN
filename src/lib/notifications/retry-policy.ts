import type { OutboxRow } from "./types";
export function notificationRetryEligible(row: OutboxRow, now = Date.now()) {
  return (
    row.channel === "resend" &&
    ["failed_permanently", "retry_scheduled"].includes(row.status) &&
    [
      "transient",
      "rate_limited",
      "configuration",
      "invalid_recipient",
      "disabled",
    ].includes(row.last_error ?? "") &&
    row.manual_retry_count < 3 &&
    row.attempt_count < 6 &&
    (!row.first_attempt_at ||
      new Date(row.first_attempt_at).getTime() > now - 23 * 3600000)
  );
}
