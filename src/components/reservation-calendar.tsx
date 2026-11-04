"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { Bike, ArrowUpRight, X, CalendarDays } from "lucide-react";
import {
  calendarActivity,
  rentalActivityStyles,
  intersectsDay,
  monthlyRentalLabel,
  dayTimeline,
  manilaEventTime,
  periodBars,
  calendarStatus,
  type CalendarReservation,
} from "@/lib/reservation-calendar";
import { formatDate } from "@/components/admin-ui";

const statuses: Record<string, { label: string; color: string }> = {
  confirmed: {
    label: "Reserved",
    color: "border-blue-200 bg-blue-50 text-blue-900",
  },
  active: {
    label: "Picked Up",
    color: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  return_due: {
    label: "Return",
    color: "border-orange-200 bg-orange-50 text-orange-900",
  },
  documents_review: {
    label: "Documents need review",
    color: "border-purple-200 bg-purple-50 text-purple-900",
  },
  overdue: { label: "Overdue", color: "border-red-200 bg-red-50 text-red-900" },
  cancelled: {
    label: "Cancelled",
    color: "border-slate-200 bg-slate-100 text-slate-600",
  },
  completed: {
    label: "Completed",
    color: "border-slate-200 bg-slate-50 text-slate-600",
  },
  pending: {
    label: "Awaiting confirmation",
    color: "border-purple-200 bg-purple-50 text-purple-900",
  },
  submitted: {
    label: "Awaiting confirmation",
    color: "border-purple-200 bg-purple-50 text-purple-900",
  },
  maintenance: {
    label: "Maintenance",
    color: "border-amber-200 bg-amber-50 text-amber-900",
  },
};
const friendly = (value?: string) =>
  ({
    approved: "Approved",
    under_review: "Needs review",
    submitted: "Needs review",
    resubmission_required: "Waiting for new documents",
    rejected: "Rejected",
    pending: "Not yet reviewed",
    not_required: "Not required",
  })[value ?? ""] ?? "Not yet reviewed";
export function ReservationCalendar({
  view,
  days,
  selectedMonth,
  events,
  today,
  now,
}: {
  view: "month" | "week" | "day";
  days: string[];
  selectedMonth: string;
  events: CalendarReservation[];
  today: string;
  now: number;
}) {
  const [motorcycle, setMotorcycle] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<CalendarReservation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const dayDialog = useRef<HTMLDialogElement>(null);
  const dayOpener = useRef<HTMLButtonElement | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const filtered = events.filter(
    (e) =>
      (motorcycle === "all" || e.modelId === motorcycle) &&
      (status === "all" || calendarStatus(e, now) === status),
  );
  function reservationsForDay(day: string) {
    return [
      ...new Map(
        filtered
          .filter((event) => intersectsDay(event, day))
          .map((event) => [
            `${event.maintenance ? "block" : "booking"}-${event.id}`,
            event,
          ]),
      ).values(),
    ].sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) ||
        a.motorcycle.localeCompare(b.motorcycle),
    );
  }
  const dayReservations = selectedDay ? reservationsForDay(selectedDay) : [];
  function openDay(day: string, button: HTMLButtonElement) {
    setSelectedDay(day);
    dayOpener.current = button;
    dayDialog.current?.showModal();
  }
  const models = [
    ...new Map(
      events.filter((e) => e.modelId).map((e) => [e.modelId!, e.motorcycle]),
    ).entries(),
  ];
  function open(event: CalendarReservation, button: HTMLButtonElement) {
    setSelected(event);
    opener.current = button;
    dialog.current?.showModal();
  }
  const renderEvent = (
    event: CalendarReservation,
    style?: React.CSSProperties,
    continuation = "",
    day?: string,
  ) => {
    const state =
      calendarActivity(event, now, day) ??
      statuses[calendarStatus(event, now)] ??
      statuses.pending;
    return (
      <button
        type="button"
        key={`${event.maintenance ? "block" : "booking"}-${event.id}`}
        onClick={(e) => open(event, e.currentTarget)}
        style={style}
        className={`calendar-reservation ${view === "month" ? "calendar-reservation-month" : ""} ${state.color}`}
        aria-label={`${view === "month" ? "More Information: " : ""}${event.reference}, ${event.motorcycle}, ${state.label}, pickup ${formatDate(event.start)}, return ${formatDate(event.end)}${continuation}`}
        title={`${event.reference} · ${event.motorcycle} · ${state.label}\nPickup ${formatDate(event.start)} → Return ${formatDate(event.end)}${continuation}`}
      >
        {view === "month" ? (
          <span className="block min-w-0">
            <span className="block font-semibold [overflow-wrap:anywhere]">
              {event.motorcycle}
            </span>
            <span className="mt-1 block text-[10px] font-medium [overflow-wrap:anywhere]">
              {state.label}
            </span>
            <span className="block truncate text-[10px] font-semibold underline underline-offset-2">
              More Information
            </span>
          </span>
        ) : (
          <>
            <span className="block truncate font-extrabold">
              {continuation.includes("earlier") ? "← " : ""}
              {event.motorcycle}{" "}
              <span className="font-medium">· {event.reference}</span>
              {continuation.includes("later") ? " →" : ""}
            </span>
            <span className="block truncate text-[11px]">
              {state.label} ·{" "}
              <span className="font-bold">
                ↑{" "}
                {new Intl.DateTimeFormat("en-PH", {
                  month: "short",
                  day: "numeric",
                  timeZone: "Asia/Manila",
                }).format(new Date(event.start))}{" "}
                {manilaEventTime(event.start)}
              </span>{" "}
              ·{" "}
              <span className="font-bold">
                ↓{" "}
                {new Intl.DateTimeFormat("en-PH", {
                  month: "short",
                  day: "numeric",
                  timeZone: "Asia/Manila",
                }).format(new Date(event.end))}{" "}
                {manilaEventTime(event.end)}
              </span>
            </span>
          </>
        )}
      </button>
    );
  };
  function week(weekDays: string[]) {
    const bars = periodBars(filtered, weekDays);
    const lanes = Math.max(0, ...bars.map((bar) => bar.lane + 1));
    const laneHeight = 48;
    return (
      <section key={weekDays[0]} className="border-t border-slate-200">
        <div className="grid grid-cols-7">
          {weekDays.map((day) => (
            <div
              key={day}
              className={`border-r border-slate-100 px-2 pt-2 ${day.startsWith(selectedMonth) ? "" : "bg-slate-50"}`}
            >
              <Link
                href={`?view=day&date=${day}`}
                aria-label={`Open ${day}`}
                aria-current={day === today ? "date" : undefined}
                className={`inline-flex size-9 items-center justify-center rounded-full text-sm font-bold ${day === today ? "bg-deep-teal text-white" : "text-slate-600 hover:bg-sand"}`}
              >
                {Number(day.slice(8))}
              </Link>
            </div>
          ))}
        </div>
        <div
          className="relative"
          style={{
            height: `${view === "month" ? Math.max(72, lanes * laneHeight + 8) : lanes ? lanes * laneHeight + 8 : 18}px`,
          }}
        >
          <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
            {weekDays.map((day) => (
              <div
                key={day}
                className={`border-r border-slate-100 ${day === today ? "bg-ocean/5" : !day.startsWith(selectedMonth) ? "bg-slate-50/60" : ""}`}
              />
            ))}
          </div>
          {bars.map((bar) =>
            renderEvent(
              bar.event,
              {
                position: "absolute",
                top: `${bar.lane * laneHeight + 3}px`,
                left: `${bar.left}%`,
                width: `${bar.width}%`,
                height: "42px",
              },
              `${bar.continuesBefore ? " · continues from earlier week" : ""}${bar.continuesAfter ? " · continues into later week" : ""}`,
            ),
          )}
        </div>
      </section>
    );
  }
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-bold text-deep-teal">
          Motorcycle
          <select
            className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            aria-label="Motorcycle"
            value={motorcycle}
            onChange={(e) => setMotorcycle(e.target.value)}
          >
            <option value="all">All motorcycles</option>
            {models.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-deep-teal">
          Status
          <select
            className="mt-2 block min-h-11 rounded-xl border border-slate-200 px-3 text-sm"
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(statuses)
              .filter(([key]) => key !== "submitted")
              .map(([key, state]) => (
                <option key={key} value={key}>
                  {state.label}
                </option>
              ))}
          </select>
        </label>
        <p role="status" className="ml-auto text-sm text-slate-500">
          {filtered.filter((e) => !e.maintenance).length} reservations ·
          Asia/Manila
        </p>
      </div>
      <ul
        aria-label="Calendar color legend"
        className="mb-4 flex flex-wrap gap-2"
      >
        {Object.entries(rentalActivityStyles).map(([key, color]) => (
          <li
            key={key}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${color}`}
          >
            {key}
          </li>
        ))}
        {Object.entries(statuses)
          .filter(
            ([key]) =>
              !["submitted", "confirmed", "active", "return_due"].includes(key),
          )
          .map(([key, state]) => (
            <li
              key={key}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${state.color}`}
            >
              {state.label}
            </li>
          ))}
      </ul>
      {!filtered.length && (
        <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <CalendarDays className="mx-auto mb-2 text-ocean" />
          <p className="font-bold">Your schedule is clear</p>
          <p className="mt-1 text-sm text-slate-500">
            No reservations or maintenance match this period and these filters.
          </p>
        </div>
      )}
      {view !== "day" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={view === "month" ? "min-w-[840px]" : "min-w-[630px]"}>
            <div className="grid grid-cols-7 bg-slate-50 text-center text-xs font-bold text-slate-500">
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day) => (
                <div key={day} className="py-3">
                  {day}
                </div>
              ))}
            </div>
            {view === "month" ? (
              <div className="grid grid-cols-7 items-stretch">
                {days.map((day) => {
                  const reservations = reservationsForDay(day);
                  return (
                    <section
                      key={day}
                      aria-label={day}
                      className={`min-h-36 min-w-0 border-t border-r border-slate-200 p-2 ${day === today ? "bg-teal-50 ring-1 ring-inset ring-teal-300" : day.startsWith(selectedMonth) ? "bg-white" : "bg-slate-50"}`}
                    >
                      <Link
                        href={`?view=day&date=${day}`}
                        aria-label={`Open ${day}`}
                        aria-current={day === today ? "date" : undefined}
                        className={`mb-2 inline-flex size-9 items-center justify-center rounded-full text-sm font-bold ${day === today ? "bg-deep-teal text-white" : "text-slate-600 hover:bg-sand"}`}
                      >
                        {Number(day.slice(8))}
                      </Link>
                      <div className="space-y-2">
                        {reservations
                          .slice(0, 3)
                          .map((event) =>
                            renderEvent(event, undefined, "", day),
                          )}
                        {reservations.length > 3 && (
                          <button
                            type="button"
                            onClick={(event) =>
                              openDay(day, event.currentTarget)
                            }
                            aria-label={`View all ${reservations.length} reservations on ${day}`}
                            className="min-h-10 w-full rounded-lg border border-teal-200 bg-white px-2 py-2 text-left text-xs font-bold text-ocean hover:bg-teal-50"
                          >
                            +{reservations.length - 3} more — View all
                          </button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              week(days)
            )}
          </div>
        </div>
      )}
      {view === "week" && (
        <p className="my-3 text-xs text-slate-500">
          One bar per rental. Arrows connect rentals across weeks. Scroll
          sideways on a smaller screen; exact pickup and return times appear
          below.
        </p>
      )}
      {view === "day" && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="min-w-[280px]">
            <div
              className="ml-12 grid border-b border-slate-200"
              style={{
                gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`,
              }}
            >
              {days.map((day) => (
                <Link
                  key={day}
                  href={`?view=day&date=${day}`}
                  className={`border-r border-slate-200 p-3 text-center text-sm font-bold ${day === today ? "bg-sand text-ocean" : ""}`}
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
            <div className="max-h-[36rem] overflow-y-auto">
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
                    <span className="absolute -left-11 -top-2 text-[10px] text-slate-500">
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
                    {dayTimeline(filtered, day).map((event) =>
                      renderEvent(
                        event,
                        {
                          position: "absolute",
                          top: `${event.top}%`,
                          height: `${Math.max(event.height, 2)}%`,
                          left: `${(event.lane / event.lanes) * 100}%`,
                          width: `${100 / event.lanes}%`,
                        },
                        "",
                        day,
                      ),
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {view === "week" && filtered.length > 0 && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold">This week’s rental schedule</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((event) => (
              <button
                key={`${event.maintenance ? "block" : "booking"}-${event.id}`}
                type="button"
                onClick={(e) => open(event, e.currentTarget)}
                className={`rounded-xl border p-4 text-left hover:brightness-95 ${calendarActivity(event, now)?.color ?? (statuses[calendarStatus(event, now)] ?? statuses.pending).color}`}
              >
                <p className="text-xs font-bold text-ocean">
                  {event.reference} ·{" "}
                  {calendarActivity(event, now)?.label ??
                    statuses[calendarStatus(event, now)]?.label}
                </p>
                <p className="mt-1 font-extrabold">{event.motorcycle}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Pickup: {formatDate(event.start)}
                  <br />
                  Return: {formatDate(event.end)}
                </p>
                <span className="mt-3 block text-sm font-bold text-ocean">
                  View details →
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {view === "month" && (
        <p className="mt-3 text-xs text-slate-500">
          Each card shows activity on that Manila date. Pending and cancelled
          bookings are labeled separately. Select More Information for exact
          pickup and return times. Scroll sideways on smaller screens.
        </p>
      )}
      {view === "day" && <DailyMovements events={filtered} day={days[0]} />}
      <dialog
        ref={dayDialog}
        onClose={() => dayOpener.current?.focus()}
        aria-labelledby="calendar-day-title"
        className="m-auto max-h-[90dvh] w-[min(94vw,38rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-deep-teal/60"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2
                id="calendar-day-title"
                className="text-xl font-extrabold text-deep-teal"
              >
                {selectedDay &&
                  new Intl.DateTimeFormat("en-PH", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "Asia/Manila",
                  }).format(new Date(`${selectedDay}T12:00:00+08:00`))}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {dayReservations.filter((event) => !event.maintenance).length}{" "}
                bookings
                {dayReservations.some((event) => event.maintenance)
                  ? ` · ${dayReservations.filter((event) => event.maintenance).length} maintenance blocks`
                  : ""}{" "}
                · Asia/Manila
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Showing the current motorcycle and status filters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => dayDialog.current?.close()}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-bold"
            >
              <X size={16} aria-hidden="true" />
              Close
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto p-4">
            {!dayReservations.length && (
              <p className="p-4 text-sm text-slate-500">
                No reservations match this date and these filters.
              </p>
            )}
            <ul className="space-y-3">
              {dayReservations.map((event) => {
                const state =
                  calendarActivity(event, now, selectedDay ?? undefined) ??
                  statuses[calendarStatus(event, now)] ??
                  statuses.pending;
                return (
                  <li
                    key={`${event.maintenance ? "block" : "booking"}-${event.id}`}
                    className={`rounded-xl border p-4 ${state.color}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-extrabold [overflow-wrap:anywhere]">
                        {event.motorcycle}
                      </h3>
                      <span className="text-xs font-bold">{state.label}</span>
                    </div>
                    {!event.maintenance && (
                      <p className="mt-1 text-sm">
                        {event.customer ?? "Customer name unavailable"}
                      </p>
                    )}
                    <p className="mt-1 text-xs">
                      {event.reference}
                      {selectedDay
                        ? ` · ${monthlyRentalLabel(event, selectedDay)}`
                        : ""}
                    </p>
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="font-bold">
                          {event.maintenance ? "Starts" : "Pickup"}
                        </dt>
                        <dd className="mt-1">{formatDate(event.start)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold">
                          {event.maintenance ? "Ends" : "Return"}
                        </dt>
                        <dd className="mt-1">{formatDate(event.end)}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={(click) => open(event, click.currentTarget)}
                      className="mt-3 min-h-10 rounded-lg border border-current bg-white/70 px-3 text-xs font-bold underline underline-offset-2"
                    >
                      More Information
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </dialog>
      <dialog
        ref={dialog}
        onClose={() => opener.current?.focus()}
        aria-labelledby="calendar-booking-title"
        className="m-auto max-h-[90dvh] w-[min(94vw,34rem)] overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-deep-teal/60"
      >
        {selected && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-ocean">
                  {selected.reference}
                </p>
                <h2
                  id="calendar-booking-title"
                  className="mt-1 text-2xl font-extrabold"
                >
                  {selected.maintenance
                    ? "Maintenance"
                    : (selected.customer ?? "Customer")}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close reservation details"
                onClick={() => dialog.current?.close()}
                className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="my-5 flex items-center gap-4 rounded-2xl bg-sand p-4">
              {selected.imageUrl ? (
                <Image
                  src={selected.imageUrl}
                  alt={selected.motorcycle}
                  width={100}
                  height={80}
                  unoptimized
                  className="h-20 w-24 rounded-xl object-contain"
                />
              ) : (
                <Bike size={38} className="text-ocean" />
              )}
              <div>
                <p className="font-bold">{selected.motorcycle}</p>
                <p className="text-xs text-slate-500">{selected.unit}</p>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              All times are in Asia/Manila.
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(selected.delivery || selected.collection) && (
                <div className="rounded-xl border p-3 text-sm">
                  <p>
                    Delivery:{" "}
                    {selected.delivery
                      ? `${selected.delivery.areaName ?? ""} · ${selected.delivery.address}`
                      : "Self pickup at KJM"}
                  </p>
                  <p>
                    Collection:{" "}
                    {selected.collection
                      ? `${selected.collection.areaName ?? ""} · ${selected.collection.address}`
                      : "Self return to KJM"}
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <dt className="text-xs font-bold text-blue-900">↑ Pickup</dt>
                <dd className="mt-1 font-bold">{formatDate(selected.start)}</dd>
              </div>
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                <dt className="text-xs font-bold text-orange-900">↓ Return</dt>
                <dd className="mt-1 font-bold">{formatDate(selected.end)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-slate-500">
                  Rental status
                </dt>
                <dd className="mt-1">
                  {calendarActivity(selected, now)?.label ??
                    statuses[calendarStatus(selected, now)]?.label ??
                    "Awaiting confirmation"}
                </dd>
              </div>
              {!selected.maintenance && (
                <>
                  <div>
                    <dt className="text-xs font-bold text-slate-500">
                      Documents
                    </dt>
                    <dd className="mt-1">{friendly(selected.verification)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-slate-500">
                      Payment
                    </dt>
                    <dd className="mt-1">
                      {selected.payment ?? "Check payment in full booking"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            {!selected.maintenance && (
              <div className="mt-6 space-y-3">
                {selected.verificationId &&
                  selected.verification !== "approved" && (
                    <Link
                      className="admin-button-secondary w-full justify-center"
                      href={`/dashboard/verifications/${selected.verificationId}`}
                    >
                      Review Documents
                    </Link>
                  )}
                <Link
                  className="admin-button w-full justify-center"
                  href={`/dashboard/bookings/${selected.id}`}
                >
                  View Full Booking <ArrowUpRight size={16} />
                </Link>
                <p className="text-xs text-slate-500">
                  Pickup and return actions are available in the full booking
                  after the required checks.
                </p>
              </div>
            )}
          </>
        )}
      </dialog>
    </>
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
    .filter(
      (e) => !e.maintenance && !["cancelled", "completed"].includes(e.status),
    )
    .flatMap((event) => [
      { type: "Pickup", instant: event.start, event },
      { type: "Return", instant: event.end, event },
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
      <h2 className="font-bold">Scheduled pickups and returns</h2>
      {!movements.length && (
        <p className="mt-3 text-sm text-slate-500">
          No scheduled pickups or returns on this day.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {movements.map((m) => (
          <li key={`${m.type}-${m.event.id}`}>
            <Link
              href={`/dashboard/bookings/${m.event.id}`}
              className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"
            >
              <strong
                className={
                  m.type === "Pickup" ? "text-blue-900" : "text-orange-900"
                }
              >
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
