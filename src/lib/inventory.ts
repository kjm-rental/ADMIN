type Unit = { id: string; status: string };
type Booking = { motorcycle_unit_id: string | null; status: string };
type Hold = {
  motorcycle_unit_id: string;
  expires_at: string;
  released_at: string | null;
  converted_at: string | null;
};
export function inventorySummary(
  units: Unit[],
  bookings: Booking[],
  holds: Hold[],
  now = Date.now(),
) {
  const rented = new Set(
    bookings
      .filter((b) => b.status === "active")
      .map((b) => b.motorcycle_unit_id),
  );
  const reserved = new Set(
    bookings
      .filter((b) => ["submitted", "pending", "confirmed"].includes(b.status))
      .map((b) => b.motorcycle_unit_id),
  );
  holds
    .filter(
      (h) =>
        !h.released_at && !h.converted_at && Date.parse(h.expires_at) > now,
    )
    .forEach((h) => reserved.add(h.motorcycle_unit_id));
  let available = 0,
    reservedCount = 0,
    rentedCount = 0,
    unavailable = 0;
  for (const unit of units) {
    if (rented.has(unit.id) || unit.status === "rented") rentedCount++;
    else if (reserved.has(unit.id) || unit.status === "reserved")
      reservedCount++;
    else if (unit.status === "available") available++;
    else unavailable++;
  }
  return {
    total: units.length,
    available,
    reserved: reservedCount,
    rented: rentedCount,
    unavailable,
  };
}
