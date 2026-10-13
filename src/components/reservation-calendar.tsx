import Link from "next/link";
import {
  dayTimeline,
  intersectsDay,
  manilaEventTime,
  type CalendarReservation,
} from "@/lib/reservation-calendar";
const colors: Record<string, string> = {
  confirmed: "border-ocean/30 bg-ocean/10 text-deep-teal",
  active: "border-green-300 bg-green-50 text-green-900",
  pending: "border-blue-200 bg-blue-50 text-blue-900",
  submitted: "border-blue-200 bg-blue-50 text-blue-900",
  completed: "border-slate-200 bg-slate-100 text-slate-600",
  maintenance: "border-amber-300 bg-amber-50 text-amber-900",
};
function Reservation({
  event,
  className = "",
  style,
}: {
  event: CalendarReservation;
  className?: string;
  style?: React.CSSProperties;
}) {
  const label = `${event.reference} · ${event.motorcycle} · ${event.unit} · ${event.status} · ${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(event.start))} to ${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(event.end))} (Asia/Manila)`;
  const content = (
    <>
      <strong className="block truncate">{event.reference}</strong>
      <span className="block truncate">{event.motorcycle}</span>
      <span className="block truncate capitalize">
        {event.status.replaceAll("_", " ")}
      </span>
    </>
  );
  const props = {
    title: label,
    style,
    className: `block min-w-0 overflow-hidden rounded-md border p-1.5 text-[10px] leading-4 ${colors[event.maintenance ? "maintenance" : event.status] ?? colors.pending} ${className}`,
  };
  return event.maintenance ? (
    <div {...props}>{content}</div>
  ) : (
    <Link
      {...props}
      href={`/dashboard/bookings/${event.id}`}
      aria-label={label}
    >
      {content}
    </Link>
  );
}
export function ReservationCalendar({
  view,
  days,
  selectedMonth,
  events,
}: {
  view: "month" | "week" | "day";
  days: string[];
  selectedMonth: string;
  events: CalendarReservation[];
}) {
  if (view === "month")
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 bg-slate-50 text-center text-xs font-bold text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div className="py-3" key={d}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const list = events.filter((e) => intersectsDay(e, day));
            return (
              <section
                key={day}
                aria-label={day}
                className={`min-h-28 min-w-0 border-t border-r border-slate-100 p-1 sm:min-h-40 sm:p-2 ${day.startsWith(selectedMonth) ? "" : "bg-slate-50/70 text-slate-400"}`}
              >
                <Link
                  className="mb-1 inline-flex size-8 items-center justify-center rounded-full text-xs font-bold hover:bg-sand"
                  href={`?view=day&date=${day}`}
                >
                  {Number(day.slice(8))}
                </Link>
                <div className="space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <Reservation key={e.id} event={e} />
                  ))}
                  {list.length > 3 && (
                    <Link
                      href={`?view=day&date=${day}`}
                      className="block text-[10px] font-bold text-ocean"
                    >
                      +{list.length - 3} more
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className={view === "week" ? "min-w-[60rem]" : "min-w-[18rem]"}>
        <div
          className="ml-12 grid border-b"
          style={{
            gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`,
          }}
        >
          {days.map((day) => (
            <Link
              key={day}
              href={`?view=day&date=${day}`}
              className="border-r p-3 text-center text-sm font-bold"
            >
              {new Date(`${day}T12:00:00Z`).toLocaleDateString("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </Link>
          ))}
        </div>
        <div className="max-h-[42rem] overflow-y-auto">
          <div
            className="relative ml-12 grid h-[72rem]"
            style={{
              gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`,
            }}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                style={{ top: `${(hour / 24) * 100}%` }}
              >
                <span className="absolute -left-11 -top-2 text-[10px] text-slate-400">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
            {days.map((day) => (
              <section
                key={day}
                aria-label={day}
                className="relative border-r border-slate-200"
              >
                {dayTimeline(events, day).map((e) => (
                  <Reservation
                    key={e.id}
                    event={e}
                    className="absolute min-h-6"
                    style={{
                      top: `${e.top}%`,
                      height: `${Math.max(e.height, 2)}%`,
                      left: `${(e.lane / e.lanes) * 100}%`,
                      width: `${100 / e.lanes}%`,
                    }}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
export function DailyMovements({
  events,
  day,
}: {
  events: CalendarReservation[];
  day: string;
}) {
  const movements = events
    .filter((e) => !e.maintenance)
    .flatMap((e) => [
      { type: "Pickup", instant: e.start, event: e },
      { type: "Return", instant: e.end, event: e },
    ])
    .filter(
      (m) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(m.instant)) === day,
    )
    .sort((a, b) => Date.parse(a.instant) - Date.parse(b.instant));
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-deep-teal">
        Scheduled pickups and returns
      </h2>
      {!movements.length && (
        <p className="mt-3 text-sm text-slate-500">
          No pickup or return movements today.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {movements.map((m) => (
          <li key={`${m.type}-${m.event.id}`}>
            <Link
              href={`/dashboard/bookings/${m.event.id}`}
              className="flex flex-wrap gap-3 text-sm"
            >
              <strong>
                {manilaEventTime(m.instant)} · {m.type}
              </strong>
              <span>
                {m.event.motorcycle} · {m.event.reference}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
