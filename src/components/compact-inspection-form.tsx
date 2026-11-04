"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { recordCompactInspection } from "@/app/actions/compact-inspection";
import { inspectionAccessories } from "@/lib/inspection-form";
import type { InspectionContext } from "@/services/inspection-context";
import type { RentalInspection } from "@/types/rental";
import { formatDate } from "./admin-ui";
export function CompactInspectionForm({
  bookingId,
  kind,
  idempotencyKey,
  context,
  pickup,
}: {
  bookingId: string;
  kind: "handover" | "return";
  idempotencyKey: string;
  context: InspectionContext;
  pickup?: RentalInspection;
}) {
  const [step, setStep] = useState(1);
  const [damage, setDamage] = useState("");
  const [fuel, setFuel] = useState<number | null>(null),
    [condition, setCondition] = useState(""),
    [accessories, setAccessories] = useState<string[]>(
      context.includedAccessories,
    ),
    [odometer, setOdometer] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [identity, setIdentity] = useState(false);
  const handover = kind === "handover",
    blocked = handover && context.checks.some((c) => !c.ready);
  const complete =
    !!odometer &&
    fuel !== null &&
    !!condition &&
    reviewed &&
    (!handover || identity);
  const missingAccessories =
    !handover && pickup
      ? inspectionAccessories.filter(
          (item) =>
            pickup.accessories_notes
              .split(/[,;\n]/)
              .some(
                (value) => value.trim().toLowerCase() === item.toLowerCase(),
              ) && !accessories.includes(item),
        )
      : [];
  return (
    <div className="space-y-3">
      <header className="rounded-xl bg-deep-teal p-3 text-white">
        <p className="text-xs opacity-75">
          {context.reference} · Unit: {context.unit}
        </p>
        <h3 className="mt-1 text-base font-extrabold">{context.model}</h3>
        {context.selectedColor && (
          <p className="mt-1 text-sm">
            Selected color: {context.selectedColor}
          </p>
        )}
        {context.plate && (
          <p className="mt-1 text-sm">License plate: {context.plate}</p>
        )}
        <p className="mt-1 text-sm">
          {context.customer} · Pickup {formatDate(context.pickup)}
        </p>
      </header>
      {handover && (
        <div className="flex flex-wrap gap-2" aria-label="Handover readiness">
          {context.checks.map((c) => (
            <a
              key={c.label}
              href={c.href}
              onClick={(event) =>
                event.currentTarget.closest("dialog")?.close()
              }
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${c.ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900 underline"}`}
            >
              {c.ready ? "✓" : "Resolve:"} {c.label}
            </a>
          ))}
        </div>
      )}
      {!handover && pickup && (
        <details className="rounded-xl bg-teal-50 p-3 text-xs" open>
          <summary className="cursor-pointer font-bold text-deep-teal">
            Pickup inspection reference
          </summary>
          <p className="mt-2">
            {pickup.odometer_km.toLocaleString()} km · Fuel{" "}
            {pickup.fuel_percent}% · {formatDate(pickup.occurred_at)}
          </p>
          <p className="mt-1">{pickup.condition_notes}</p>
          <p className="mt-1">Accessories: {pickup.accessories_notes}</p>
          {pickup.existing_damage_notes && (
            <p>Existing damage: {pickup.existing_damage_notes}</p>
          )}
        </details>
      )}
      <ActionForm
        action={recordCompactInspection}
        successMessage={
          handover
            ? "Motorcycle successfully handed over."
            : "Motorcycle return inspection saved. Deposit refund remains separate."
        }
        className="space-y-3"
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>
            {step === 1
              ? "1 / 2 · Motorcycle inspection"
              : "2 / 2 · Accessories & confirmation"}
          </span>
          {step === 2 && (
            <button
              type="button"
              className="min-h-9 text-ocean underline"
              onClick={() => setStep(1)}
            >
              Back to inspection
            </button>
          )}
        </div>
        <div hidden={step !== 1} className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-deep-teal">
              {handover ? "Current Odometer" : "Return Odometer"}
              <div className="mt-1 flex items-center gap-2">
                <input
                  name="odometerKm"
                  type="number"
                  min={pickup?.odometer_km ?? 0}
                  step="1"
                  max="2147483647"
                  required
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-200 p-2"
                />
                <span>km</span>
              </div>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {context.latestOdometer !== null
                  ? `Last recorded: ${context.latestOdometer.toLocaleString()} km. `
                  : ""}
                Enter the actual reading.
              </span>
            </label>
            <fieldset>
              <legend className="text-sm font-bold text-deep-teal">
                Fuel level
              </legend>
              <input type="hidden" name="fuelPercent" value={fuel ?? ""} />
              <div className="mt-2 flex gap-1">
                {[
                  [100, "FULL"],
                  [75, "¾"],
                  [50, "½"],
                  [25, "¼"],
                  [0, "EMPTY"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={fuel === value}
                    onClick={() => setFuel(Number(value))}
                    className={`min-h-11 flex-1 rounded-lg border px-2 text-xs font-bold ${fuel === value ? "border-deep-teal bg-deep-teal text-white" : "border-slate-200 bg-white text-deep-teal"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {!handover && pickup && (odometer || fuel !== null) && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              Since pickup:{" "}
              {odometer
                ? `${Number(odometer) - pickup.odometer_km} km`
                : "Odometer not entered"}{" "}
              ·{" "}
              {fuel === null
                ? "Fuel not selected"
                : `Fuel ${fuel - pickup.fuel_percent >= 0 ? "+" : ""}${fuel - pickup.fuel_percent} percentage points`}
              . Observations create no automatic charges.
            </p>
          )}
          <fieldset>
            <legend className="text-sm font-bold text-deep-teal">
              Motorcycle Condition
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ["good", "✓ Good Condition"],
                [
                  "damage",
                  handover ? "⚠ Existing Damage" : "⚠ Damage / Safety Concern",
                ],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${condition === value ? "border-ocean bg-teal-50" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={value}
                    checked={condition === value}
                    onChange={() => setCondition(value)}
                    required
                  />
                  {label}
                </label>
              ))}
            </div>
            {condition === "damage" ? (
              <label className="mt-2 block text-xs font-bold">
                {handover
                  ? "Describe existing damage and safety concerns"
                  : "Describe new damage, changes and safety concerns"}
                <textarea
                  required
                  value={damage}
                  onChange={(event) => setDamage(event.target.value)}
                  name="damage"
                  maxLength={1000}
                  rows={2}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
            ) : (
              <input type="hidden" name="damage" value="" />
            )}
          </fieldset>
          <button
            type="button"
            disabled={
              !odometer ||
              fuel === null ||
              !condition ||
              (condition === "damage" && !damage.trim())
            }
            onClick={() => setStep(2)}
            className="admin-button w-full disabled:opacity-40"
          >
            Continue to accessories
          </button>
        </div>
        <div hidden={step !== 2} className="space-y-3">
          <fieldset>
            <legend className="text-sm font-bold text-deep-teal">
              {handover ? "Accessories handed over" : "Accessories returned"}
            </legend>
            <p className="mt-1 text-xs text-slate-500">
              Select only the items physically{" "}
              {handover ? "handed over" : "returned"}.{" "}
              {handover
                ? "Selections suggested from saved booking inclusions only; confirm the actual items."
                : "Compare with the pickup list above; note missing items below."}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {inspectionAccessories.map((item) => (
                <label
                  key={item}
                  className={`flex min-h-10 items-center gap-2 rounded-lg border px-2 text-xs ${accessories.includes(item) ? "border-ocean bg-teal-50" : "border-slate-200"}`}
                >
                  <input
                    type="checkbox"
                    name="accessories"
                    value={item}
                    checked={accessories.includes(item)}
                    onChange={(e) =>
                      setAccessories((previous) =>
                        e.target.checked
                          ? [...previous, item]
                          : previous.filter((v) => v !== item),
                      )
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>
          {missingAccessories.length > 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              Not marked returned from pickup: {missingAccessories.join(", ")}.
              Confirm and record missing items in Additional Details. No charge
              is applied automatically.
            </p>
          )}
          <details className="rounded-lg border border-slate-200 px-3">
            <summary className="cursor-pointer py-3 text-sm font-bold text-deep-teal">
              Additional Details
            </summary>
            <div className="space-y-3 pb-3">
              <label className="block text-xs font-bold">
                {handover
                  ? "Special observations / operational notes"
                  : "Missing accessories, fuel or other charge observations"}
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={2}
                  className="mt-1 w-full rounded-lg border p-2"
                />
              </label>
              <label className="block text-xs font-bold">
                Additional accessories
                <input
                  name="extraAccessories"
                  maxLength={500}
                  className="mt-1 min-h-10 w-full rounded-lg border p-2"
                />
              </label>
              <label className="block text-xs font-bold">
                Exceptional actual time correction · Asia/Manila
                <input
                  name="occurredAt"
                  type="datetime-local"
                  className="mt-1 min-h-10 w-full rounded-lg border p-2"
                />
                <span className="mt-1 block font-normal text-slate-500">
                  Leave blank to record the current time automatically.
                </span>
              </label>
            </div>
          </details>
          <div className="space-y-2 text-xs leading-5">
            <label className="flex gap-2">
              <input
                type="checkbox"
                required
                name="accessoriesChecked"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I inspected the motorcycle, confirmed the actual odometer and
              fuel, and checked all accessories.
            </label>
            {handover && (
              <label className="flex gap-2">
                <input
                  required
                  type="checkbox"
                  name="identityChecked"
                  checked={identity}
                  onChange={(e) => setIdentity(e.target.checked)}
                />
                I rechecked the customer’s identity and current driving
                eligibility.
              </label>
            )}
          </div>
          {blocked && (
            <p role="status" className="text-xs font-bold text-amber-900">
              Resolve the highlighted readiness checks before handover.
            </p>
          )}
          <SubmitButton disabled={blocked || !complete} className="w-full">
            {handover
              ? "Confirm Motorcycle Handed Over"
              : "Confirm Motorcycle Returned"}
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
