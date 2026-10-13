import type { BookingDeposit, DepositEvent } from "@/types/rental";
export function depositBalance(
  requirement: BookingDeposit,
  events: DepositEvent[],
) {
  const selected = events
    .filter(
      (event) =>
        event.booking_id === requirement.booking_id &&
        event.is_test === requirement.is_test,
    )
    .sort((a, b) => a.sequence - b.sequence);
  let collected = 0,
    returned = 0,
    custody = 0,
    unresolved = false;
  for (const event of selected) {
    if (event.event_type === "cash_collected")
      collected += event.amount_centavos;
    if (event.event_type === "cash_returned") returned += event.amount_centavos;
    if (event.event_type === "id_received") custody++;
    if (event.event_type === "id_returned") custody--;
    if (event.event_type === "case_opened") unresolved = true;
    if (event.event_type === "case_resolved") unresolved = false;
  }
  const held = collected - returned;
  const status = unresolved
    ? "Pending resolution"
    : requirement.option === "eligible_id"
      ? custody > 0
        ? "Document received"
        : selected.some((e) => e.event_type === "id_returned")
          ? "Document returned"
          : "Awaiting document"
      : collected === 0
        ? "Not collected"
        : held === 0
          ? "Fully returned"
          : returned > 0
            ? "Partially returned"
            : "Collected";
  return {
    collected,
    returned,
    held,
    custody,
    unresolved,
    status,
    events: selected,
  };
}
