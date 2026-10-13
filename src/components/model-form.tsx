import { ActionForm } from "@/components/action-form";
import { saveModel } from "@/app/actions/fleet";
import { SubmitButton } from "@/components/submit-button";
import type { Database } from "@/types/database";
type Model = Database["public"]["Tables"]["motorcycle_models"]["Row"];
const control =
  "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-deep-teal shadow-sm outline-none transition placeholder:text-slate-300 focus:border-ocean focus:ring-3 focus:ring-ocean/10";
export function ModelForm({
  model,
  weekly,
  monthly,
}: {
  model?: Model;
  weekly?: number;
  monthly?: number;
}) {
  const features = Array.isArray(model?.notable_features)
    ? model.notable_features
        .filter((v): v is string => typeof v === "string")
        .join("\n")
    : "";
  return (
    <ActionForm action={saveModel} className="space-y-6">
      {model && <input type="hidden" name="id" value={model.id} />}
      <nav className="admin-subnav" aria-label="Motorcycle form sections">
        {[
          "Identity",
          "Pricing",
          "Technical specifications",
          "Catalog content",
        ].map((title) => (
          <a key={title} href={`#${title.toLowerCase().replaceAll(" ", "-")}`}>
            {title}
          </a>
        ))}
      </nav>
      <Panel
        title="Identity"
        description="Customer-facing model identity and classification."
      >
        <Field label="Brand" name="brand" required value={model?.brand} />
        <Field
          label="Model name"
          name="modelName"
          required
          value={model?.model_name}
        />
        <Field
          label="Public display name"
          name="displayName"
          required
          value={model?.display_name}
        />
        <Field
          label="Generation / version"
          name="generation"
          value={model?.generation}
        />
        <Field label="Model year" name="modelYear" value={model?.model_year} />
        <Field label="Category" name="category" value={model?.category} />
      </Panel>
      <Panel
        title="Pricing"
        description="Store all amounts as whole Philippine pesos."
      >
        <Field
          label="Daily rate (PHP)"
          name="dailyRate"
          required
          type="number"
          min="0"
          step="1"
          value={model?.daily_rate_php}
        />
        <Field
          label="Weekly rate (optional)"
          name="weeklyRate"
          type="number"
          min="1"
          step="1"
          value={weekly}
        />
        <Field
          label="Monthly rate (optional)"
          name="monthlyRate"
          type="number"
          min="1"
          step="1"
          value={monthly}
        />
      </Panel>
      <Panel
        title="Technical specifications"
        description="Use verified manufacturer references where possible."
      >
        <Field
          label="Exact manufacturer model"
          name="exactModelName"
          value={model?.exact_model_name}
        />
        <Field
          label="Engine displacement (cc)"
          name="engineCc"
          type="number"
          min="1"
          step="1"
          value={model?.engine_cc}
        />
        <Field
          label="Transmission"
          name="transmission"
          value={model?.transmission}
        />
        <Field
          label="Fuel tank capacity (L)"
          name="fuelTankCapacity"
          type="number"
          min="0.1"
          step="0.1"
          value={model?.fuel_tank_capacity_liters}
        />
        <Field
          label="Cooling system"
          name="coolingSystem"
          value={model?.cooling_system}
        />
        <Field
          label="Starting system"
          name="startingSystem"
          value={model?.starting_system}
        />
        <Field
          label="Braking system"
          name="brakingSystem"
          value={model?.braking_system}
          wide
        />
        <label className="text-sm font-bold text-deep-teal">
          Verification status
          <select
            name="specificationStatus"
            defaultValue={model?.specification_status ?? "pending"}
            className={control}
          >
            <option value="pending">Pending confirmation</option>
            <option value="reference_only">Reference only</option>
            <option value="verified">Verified</option>
          </select>
        </label>
        <Field
          label="Manufacturer reference URL"
          name="specificationSourceUrl"
          type="url"
          placeholder="https://"
          value={model?.specification_source_url}
          wide
        />
        <label className="text-sm font-bold text-deep-teal md:col-span-2">
          Specification note
          <textarea
            required
            name="specificationNote"
            defaultValue={
              model?.specification_note ??
              "Exact model year and variant pending confirmation."
            }
            rows={3}
            className={control}
          />
        </label>
      </Panel>
      <Panel
        title="Catalog content"
        description="Clear information shown on KJM MAIN after publication."
      >
        <label className="text-sm font-bold text-deep-teal md:col-span-2">
          Description
          <textarea
            name="description"
            defaultValue={model?.description ?? ""}
            rows={5}
            className={control}
          />
        </label>
        <label className="text-sm font-bold text-deep-teal md:col-span-2">
          Features{" "}
          <span className="font-normal text-slate-400">(one per line)</span>
          <textarea
            name="features"
            defaultValue={features}
            rows={5}
            className={control}
          />
        </label>
      </Panel>
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="published"
            defaultChecked={model?.is_published ?? false}
            className="mt-1 size-4 accent-ocean"
          />
          <span>
            <span className="block text-sm font-bold text-deep-teal">
              Publish on KJM MAIN
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Leave unchecked to save as a private draft. Publication does not
              mean availability.
            </span>
          </span>
        </label>
        <SubmitButton pendingLabel="Saving motorcycle…">
          {model ? "Save motorcycle" : "Create motorcycle"}
        </SubmitButton>
      </section>
    </ActionForm>
  );
}
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={title.toLowerCase().replaceAll(" ", "-")}
      className="admin-form-section"
    >
      <header>
        <h2 className="text-lg font-extrabold text-deep-teal">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({
  label,
  name,
  value,
  wide,
  ...props
}: {
  label: string;
  name: string;
  value?: string | number | null;
  wide?: boolean;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue"
>) {
  return (
    <label
      className={`text-sm font-bold text-deep-teal ${wide ? "md:col-span-2" : ""}`}
    >
      {label}
      <input
        name={name}
        defaultValue={value ?? ""}
        className={control}
        {...props}
      />
    </label>
  );
}
