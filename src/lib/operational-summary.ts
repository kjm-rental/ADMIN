import type { Database } from "@/types/database";
type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Payment = Database["public"]["Tables"]["payment_events"]["Row"];
export function summarizePayments(
  bookings: Booking[],
  events: Payment[],
  test = false,
) {
  const selected = bookings.filter((b) => b.is_test === test);
  const ids = new Set(selected.map((b) => b.id));
  const payments = events.filter(
    (e) => e.is_test === test && ids.has(e.booking_id),
  );
  const sums = { payment: 0, refund: 0, reversal: 0 };
  const balances = new Map<string, number>();
  for (const event of payments) {
    if (!Object.hasOwn(sums, event.event_type)) continue;
    const kind = event.event_type as keyof typeof sums;
    sums[kind] += event.amount_centavos;
    balances.set(
      event.booking_id,
      (balances.get(event.booking_id) ?? 0) +
        (kind === "payment" ? event.amount_centavos : -event.amount_centavos),
    );
  }
  const outstanding = selected
    .filter((b) => ["confirmed", "active", "completed"].includes(b.status))
    .reduce(
      (sum, b) =>
        sum + Math.max(0, b.total_centavos - (balances.get(b.id) ?? 0)),
      0,
    );
  return {
    ...sums,
    net: sums.payment - sums.refund - sums.reversal,
    outstanding,
    payments,
    balances,
    bookings: selected,
  };
}
export const manilaDay = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
