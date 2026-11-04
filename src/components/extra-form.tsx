"use client";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { saveExtra } from "@/app/actions/extras";
import { SubmitButton } from "@/components/submit-button";
type Extra = {
  compatible_unit_ids?: string[];
  compatible_model_ids?: string[];
  id: string;
  name: string;
  description: string | null;
  price_php: number;
  display_order: number;
  is_available: boolean;
  pricing_model: string;
  total_quantity: number;
  max_per_booking: number;
};
export function ExtraForm({
  extra,
  models,
  units,
  compatibilityReady,
}: {
  extra?: Extra;
  models: { id: string; display_name: string }[];
  units: {
    id: string;
    motorcycle_model_id: string;
    internal_unit_code: string;
    registration_plate: string | null;
    status: string;
  }[];
  compatibilityReady: boolean;
}) {
  const [name, setName] = useState(extra?.name ?? "Helmet");
  const [stock, setStock] = useState(extra?.total_quantity ?? 1);
  const [limit, setLimit] = useState(extra?.max_per_booking ?? 1);
  const [selectedUnits, setSelectedUnits] = useState(
    extra?.compatible_unit_ids?.length
      ? extra.compatible_unit_ids
      : units
          .filter((unit) =>
            extra?.compatible_model_ids?.includes(unit.motorcycle_model_id),
          )
          .map((unit) => unit.id),
  );
  const [specific, setSpecific] = useState(
    Boolean(
      extra?.compatible_unit_ids?.length || extra?.compatible_model_ids?.length,
    ) || /(?:top|back)[ _-]*box/i.test(extra?.name ?? ""),
  );
  const box = /(?:top|back)[ _-]*box/i.test(name);
  const capped = /^(helmets?|raincoats?)$/i.test(name.trim());
  const compatibilityFields = (
    <fieldset className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-bold text-deep-teal">
        Which bikes can use this accessory?
      </legend>
      <div className="flex flex-wrap gap-5 text-xs font-semibold text-deep-teal">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="bikeScope"
            value="all"
            checked={!specific && !box}
            disabled={box}
            onChange={() => setSpecific(false)}
          />
          All bikes
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="bikeScope"
            value="specific"
            checked={specific || box}
            onChange={() => setSpecific(true)}
          />
          Choose specific bikes / units
        </label>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {box
          ? "Back boxes need a compatible unit ready for installation. Select those units below; leave empty to keep this box hidden from customers."
          : "Helmets and raincoats can be offered with all bikes. Choose specific units for accessories that only fit certain bikes."}
      </p>
      {compatibilityReady ? (
        <>
          <input
            type="hidden"
            name="unitCompatibilityConfigured"
            value="true"
          />
          {(specific || box) && (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-2">
              {units.length ? (
                units.map((unit) => (
                  <label
                    key={unit.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-50 p-3 text-xs text-deep-teal"
                  >
                    <input
                      type="checkbox"
                      name="compatibleUnitIds"
                      value={unit.id}
                      checked={selectedUnits.includes(unit.id)}
                      onChange={(event) =>
                        setSelectedUnits((current) =>
                          event.target.checked
                            ? [...current, unit.id]
                            : current.filter((id) => id !== unit.id),
                        )
                      }
                      className="mt-0.5 accent-ocean"
                    />
                    <span>
                      <strong className="block">
                        {models.find(
                          (model) => model.id === unit.motorcycle_model_id,
                        )?.display_name ?? "Motorcycle"}
                      </strong>
                      <span className="mt-1 block text-slate-500">
                        {unit.registration_plate ?? unit.internal_unit_code} ·{" "}
                        {unit.status}
                      </span>
                    </span>
                  </label>
                ))
              ) : (
                <p className="p-3 text-xs text-slate-500">
                  Add your motorcycle units in Fleet Management first.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p
          role="status"
          className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900"
        >
          Bike compatibility setup is not active in the database yet. Helmets
          and raincoats can still be added for all bikes. Specific-bike
          restrictions require the prepared accessory migration; back boxes stay
          hidden online until then.
        </p>
      )}
    </fieldset>
  );
  return (
    <ActionForm action={saveExtra} className="mt-4 grid gap-4 sm:grid-cols-2">
      {extra && <input type="hidden" name="id" value={extra.id} />}
      {!extra && (
        <fieldset className="sm:col-span-2 rounded-xl bg-slate-50 p-4">
          <legend className="text-xs font-bold text-deep-teal">
            What would you like to add?
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Helmet", name: "Helmet", limit: 2 },
              { label: "Raincoat", name: "Raincoat", limit: 2 },
              { label: "Back box", name: "Top Box", limit: 1 },
              { label: "Other accessory", name: "", limit: 1 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setName(preset.name);
                  setLimit(preset.limit);
                  setSpecific(preset.name === "Top Box");
                  setSelectedUnits([]);
                }}
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-bold ${name === preset.name ? "border-ocean bg-white text-ocean" : "border-slate-200 text-slate-600"}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="text-xs font-bold text-deep-teal">
        Accessory name
        <input
          required
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>
      <label className="text-xs font-bold text-deep-teal">
        Stock quantity
        <input
          required
          type="number"
          min="0"
          name="totalQuantity"
          value={stock}
          onChange={(event) => setStock(Number(event.target.value))}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>
      <label className="text-xs font-bold text-deep-teal">
        Price (PHP)
        <input
          required
          type="number"
          min="0"
          step="1"
          name="pricePhp"
          defaultValue={extra?.price_php ?? 0}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>
      <label className="text-xs font-bold text-deep-teal">
        Charge
        <select
          name="pricingModel"
          defaultValue={extra?.pricing_model ?? "per_rental"}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="per_rental">Once per rental</option>
          <option value="per_day">Each rental day</option>
        </select>
      </label>
      <label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-deep-teal">
        <input
          type="checkbox"
          name="available"
          defaultChecked={extra?.is_available ?? true}
          className="size-4 accent-ocean"
        />
        Show on booking page
      </label>
      <details className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-bold text-deep-teal">
          More options · photo, description & booking limit
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-deep-teal">
            Maximum per booking
            <input
              required
              type="number"
              min="1"
              name="maxPerBooking"
              value={Math.min(
                limit,
                Math.max(stock, 1),
                box ? 1 : capped ? 2 : limit,
              )}
              max={box ? 1 : capped ? 2 : undefined}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-deep-teal sm:col-span-2">
            Image (optional)
            <input
              type="file"
              name="image"
              accept="image/avif,image/webp,image/jpeg,image/png"
              className="mt-1 block w-full rounded-xl border border-dashed border-slate-200 p-3 text-xs"
            />
          </label>
          <label className="text-xs font-bold text-deep-teal sm:col-span-2">
            Description
            <textarea
              name="description"
              defaultValue={extra?.description ?? ""}
              className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-deep-teal">
            Display order
            <input
              required
              type="number"
              min="0"
              step="1"
              name="displayOrder"
              defaultValue={extra?.display_order ?? 0}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>
      </details>
      {box || specific ? (
        <> {compatibilityFields}</>
      ) : (
        <details className="sm:col-span-2 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-bold text-deep-teal">
            Bike restrictions · all bikes by default
          </summary>
          <div className="mt-4"> {compatibilityFields}</div>
        </details>
      )}
      <SubmitButton
        disabled={
          ((box || specific) && !compatibilityReady) ||
          (specific && !box && selectedUnits.length === 0)
        }
        className="rounded-xl bg-deep-teal px-4 py-3 text-sm font-bold text-white sm:col-span-2"
      >
        {extra ? "Save changes" : "Add accessory"}
      </SubmitButton>
    </ActionForm>
  );
}
