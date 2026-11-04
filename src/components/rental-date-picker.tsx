"use client";

import { useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  rentalCalendarDays,
  rentalCalendarLabel,
  shiftRentalMonth,
} from "@/lib/rental-calendar";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function RentalDatePicker({
  label,
  value,
  minDate,
  rangeStart,
  rangeEnd,
  onChange,
}: {
  label: string;
  value: string;
  minDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const [today, setToday] = useState("");
  const minimum = minDate && minDate > today ? minDate : today;
  function toggle() {
    if (!open) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const part = (type: string) => parts.find((p) => p.type === type)!.value;
      const now = `${part("year")}-${part("month")}-${part("day")}`;
      setToday(now);
      setMonth(
        (value || (minDate && minDate > now ? minDate : now)).slice(0, 7),
      );
    }
    setOpen(!open);
  }
  function choose(date: string) {
    onChange(date);
    setOpen(false);
    trigger.current?.focus();
  }
  const year = Number(month.slice(0, 4));
  const firstYear = Math.min(year, Number(today.slice(0, 4)) || year);
  return (
    <div
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`${label} date`}
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-sm font-semibold outline-none focus:ring-2 focus:ring-ocean/20 ${open ? "border-ocean text-ocean" : "border-slate-200 text-deep-teal"}`}
      >
        <span>{value ? rentalCalendarLabel(value) : "Choose date"}</span>
        <CalendarDays size={18} className="shrink-0 text-ocean" />
      </button>
      {open && month && (
        <div
          id={id}
          role="region"
          aria-label={`${label} calendar`}
          className="mt-2 rounded-2xl border border-ocean/20 bg-white p-3 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              disabled={shiftRentalMonth(month, -1) < minimum.slice(0, 7)}
              onClick={() => setMonth(shiftRentalMonth(month, -1))}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ocean hover:bg-ocean/10 disabled:opacity-25"
            >
              <ChevronLeft size={18} />
            </button>
            <select
              aria-label={`${label} month`}
              value={month.slice(5)}
              onChange={(e) => setMonth(`${year}-${e.target.value}`)}
              className="min-h-10 min-w-0 flex-1 rounded-lg bg-slate-50 px-1 text-xs font-bold text-deep-teal"
            >
              {months.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, "0")}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label={`${label} year`}
              value={year}
              onChange={(e) => setMonth(`${e.target.value}-${month.slice(5)}`)}
              className="min-h-10 w-20 shrink-0 rounded-lg bg-slate-50 px-1 text-xs font-bold text-deep-teal"
            >
              {Array.from(
                { length: Math.max(11, year - firstYear + 1) },
                (_, i) => firstYear + i,
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(shiftRentalMonth(month, 1))}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ocean hover:bg-ocean/10"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span
                key={index}
                className="py-1 text-[10px] font-bold text-slate-400"
                aria-hidden="true"
              >
                {day}
              </span>
            ))}
            {rentalCalendarDays(month).map((date) => (
              <button
                key={date}
                type="button"
                data-date={date}
                aria-label={rentalCalendarLabel(date)}
                aria-pressed={date === value}
                aria-current={date === today ? "date" : undefined}
                disabled={date < minimum}
                onClick={() => choose(date)}
                onKeyDown={(event) => {
                  const delta = (
                    {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -7,
                      ArrowDown: 7,
                    } as Record<string, number>
                  )[event.key];
                  if (!delta) return;
                  event.preventDefault();
                  const next = new Date(`${date}T12:00:00Z`);
                  next.setUTCDate(next.getUTCDate() + delta);
                  event.currentTarget.parentElement
                    ?.querySelector<HTMLButtonElement>(
                      `[data-date="${next.toISOString().slice(0, 10)}"]:not(:disabled)`,
                    )
                    ?.focus();
                }}
                className={`aspect-square min-w-0 rounded-lg text-xs font-semibold outline-none transition-colors focus:ring-2 focus:ring-ocean disabled:cursor-not-allowed disabled:opacity-20 ${date === value ? "bg-deep-teal text-white" : rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd ? "bg-ocean/10 text-ocean" : date.slice(0, 7) !== month ? "text-slate-300 hover:bg-slate-50" : date === today ? "bg-sand text-ocean ring-1 ring-inset ring-ocean/30 hover:bg-ocean/10" : "text-deep-teal hover:bg-ocean/10"}`}
              >
                {Number(date.slice(8))}
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-xs font-bold text-ocean">
            <button
              type="button"
              disabled={today < minimum}
              onClick={() => choose(today)}
              className="min-h-9 rounded-lg px-2 hover:bg-ocean/10 disabled:opacity-30"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => choose("")}
              className="min-h-9 rounded-lg px-2 hover:bg-ocean/10"
            >
              Clear date
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
