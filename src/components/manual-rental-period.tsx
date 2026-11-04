"use client";

import { useState } from "react";
import {
  rentalReturnAfter,
  rentalTime24,
  rentalTimeParts,
} from "@/lib/rental-date-selection";
import { RentalDatePicker } from "@/components/rental-date-picker";
import { rentalDuration } from "@/lib/rental-duration";

const control =
  "min-h-11 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-transparent px-2 text-center text-sm font-semibold text-deep-teal outline-none focus:bg-ocean/5 focus:ring-2 focus:ring-inset focus:ring-ocean/30";

function RentalDateTime({
  label,
  value,
  minDate,
  onChange,
}: {
  label: string;
  value: string;
  minDate?: string;
  onChange: (value: string) => void;
}) {
  const [draftTime, setDraftTime] = useState("09:00");
  const date = value.split("T")[0] ?? "";
  const time = value.split("T")[1]?.slice(0, 5) || draftTime;
  const parts = rentalTimeParts(time);
  const minutes = [...new Set(["00", "15", "30", "45", parts.minute])].sort();
  function changeTime(patch: Partial<typeof parts>) {
    const next = { ...parts, ...patch };
    const selected = rentalTime24(next.hour, next.minute, next.period);
    setDraftTime(selected);
    if (date) onChange(`${date}T${selected}`);
  }
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-bold text-slate-500">{label}</legend>
      <div className="text-xs font-semibold text-slate-500">
        <RentalDatePicker
          label={label}
          value={date}
          minDate={minDate}
          onChange={(selected) =>
            onChange(selected ? `${selected}T${time}` : "")
          }
        />
      </div>
      <div>
        <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-1">
          <select
            aria-label={`${label} hour`}
            value={parts.hour}
            onChange={(e) => changeTime({ hour: e.target.value })}
            className={control}
          >
            {Array.from({ length: 12 }, (_, i) =>
              String(i + 1).padStart(2, "0"),
            ).map((hour) => (
              <option key={hour}>{hour}</option>
            ))}
          </select>
          <span aria-hidden="true" className="text-slate-400">
            :
          </span>
          <select
            aria-label={`${label} minute`}
            value={parts.minute}
            onChange={(e) => changeTime({ minute: e.target.value })}
            className={control}
          >
            {minutes.map((minute) => (
              <option key={minute}>{minute}</option>
            ))}
          </select>
          <select
            aria-label={`${label} AM or PM`}
            value={parts.period}
            onChange={(e) => changeTime({ period: e.target.value })}
            className={control}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}

export function ManualRentalPeriod({
  startAt,
  endAt,
  onChange,
}: {
  startAt: string;
  endAt: string;
  onChange: (patch: { startAt?: string; endAt?: string }) => void;
}) {
  const duration =
    startAt && endAt
      ? rentalDuration(`${startAt}:00+08:00`, `${endAt}:00+08:00`)
      : null;
  return (
    <div className="mt-5 space-y-3 border-y border-slate-100 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <RentalDateTime
          label="Pickup"
          value={startAt}
          onChange={(value) =>
            onChange({
              startAt: value,
              ...(!endAt && value
                ? { endAt: rentalReturnAfter(value, 1) }
                : {}),
            })
          }
        />
        <RentalDateTime
          label="Return"
          value={endAt}
          minDate={startAt.slice(0, 10) || undefined}
          onChange={(value) => onChange({ endAt: value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-slate-500">
          Quick duration
        </span>
        {[1, 2, 3, 7].map((days) => {
          const value = rentalReturnAfter(startAt, days);
          return (
            <button
              key={days}
              type="button"
              disabled={!startAt}
              aria-pressed={Boolean(value && endAt === value)}
              onClick={() => onChange({ endAt: value })}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${value && endAt === value ? "bg-deep-teal text-white" : "bg-slate-50 text-slate-600 hover:bg-ocean/10 hover:text-ocean"}`}
            >
              {days} {days === 1 ? "day" : "days"}
            </button>
          );
        })}
      </div>
      <p
        role="status"
        className={`text-xs ${startAt && endAt && !duration ? "text-amber-800" : "font-semibold text-ocean"}`}
      >
        {duration
          ? `Rental duration: ${duration.label}`
          : startAt && endAt
            ? "Return must be at least 24 hours after pickup."
            : "Choose pickup and return dates. Return defaults to 24 hours after pickup."}
      </p>
    </div>
  );
}
