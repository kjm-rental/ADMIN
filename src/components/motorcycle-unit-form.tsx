import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveMotorcycleUnit } from "@/app/actions/motorcycle-units";
import { MotorcycleUnitLifecycle } from "@/components/motorcycle-unit-lifecycle";

export function MotorcycleUnitForm({
  modelId,
  modelName,
  unit,
}: {
  modelId: string;
  modelName: string;
  unit?: {
    id: string;
    registration_plate: string | null;
    color: string | null;
    status: string;
  };
}) {
  const input =
    "mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm";
  const listId = `unit-colors-${unit?.id ?? "new"}`;
  return (
    <>
      <ActionForm
        action={saveMotorcycleUnit}
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="modelId" value={modelId} />
        {unit && <input type="hidden" name="unitId" value={unit.id} />}
        <label className="text-sm">
          License Plate Number{!unit && " *"}
          <input
            name="plate"
            required={!unit}
            maxLength={100}
            defaultValue={unit?.registration_plate ?? ""}
            className={`${input} uppercase`}
            autoComplete="off"
          />
        </label>
        <label className="text-sm">
          Motorcycle Color{!unit && " *"}
          <input
            name="color"
            list={listId}
            required={!unit}
            maxLength={100}
            defaultValue={unit?.color ?? ""}
            className={input}
            placeholder="Choose or enter a custom color"
          />
          <datalist id={listId}>
            {[
              "Black",
              "White",
              "Red",
              "Yellow",
              "Blue",
              "Gray",
              "Green",
              "Brown",
              "Matte Black",
              "White / Black",
              "Red / Black",
              "Black / Gray",
              "Black / Blue",
            ].map((color) => (
              <option key={color} value={color} />
            ))}
          </datalist>
        </label>
        <div className="self-end">
          <SubmitButton>{unit ? "Save unit" : "Add unit"}</SubmitButton>
        </div>
      </ActionForm>
      {unit && (
        <MotorcycleUnitLifecycle
          modelId={modelId}
          modelName={modelName}
          unit={unit}
        />
      )}
    </>
  );
}
