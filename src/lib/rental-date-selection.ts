/** Add calendar days to a Manila wall-clock value without using host timezone. */
export function rentalReturnAfter(start: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return "";
  const date = new Date(`${start}:00+08:00`);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + (days * 24 + 8) * 3600000)
    .toISOString()
    .slice(0, 16);
}

export function rentalTimeParts(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return {
    hour: String(hour % 12 || 12).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    period: hour >= 12 ? "PM" : "AM",
  };
}

export function rentalTime24(hour: string, minute: string, period: string) {
  return `${String((Number(hour) % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}`;
}
