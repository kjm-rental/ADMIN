/** Convert Manila wall-clock input once; explicitly zoned timestamps retain their instant. */
const zone = "Asia/Manila";
export function businessTimestamp(value: string): string {
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    // Validate the calendar portion too: Date otherwise normalizes February 30.
    const wallClock = value
      .replace(/(?:Z|[+-]\d{2}:\d{2})$/, "")
      .replace(/\.\d{1,3}$/, "");
    businessTimestamp(wallClock);
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      throw new Error("Enter a valid payment date and time.");
    return date.toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match)
    throw new Error(
      "Enter a date and time in Asia/Manila; a date alone is not a timestamp.",
    );
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second || 0, 0);
  if (
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() !== month - 1 ||
    wall.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    (second || 0) > 59
  )
    throw new Error("Enter a valid date and time.");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(wall).map((p) => [p.type, p.value]),
  );
  const local = new Date(0);
  local.setUTCFullYear(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
  local.setUTCHours(
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    0,
  );
  return new Date(
    wall.getTime() - (local.getTime() - wall.getTime()),
  ).toISOString();
}

/** Format a stored instant for datetime-local, without adding a numeric offset. */
export function businessDateTimeInput(timestamp: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(timestamp))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
