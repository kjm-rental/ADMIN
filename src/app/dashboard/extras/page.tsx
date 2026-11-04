import { ExtraForm } from "@/components/extra-form";
import Image from "next/image";
import { StatusBadge, formatPHP, EmptyState } from "@/components/admin-ui";
import { PackagePlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";

export default async function ExtrasPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const flash = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: extras, error } = await supabase
    .from("booking_extras_catalog")
    .select("*")
    .order("display_order")
    .order("name");
  if (error) throw new Error(error.message);
  const { data: compatibilityModels, error: modelError } = await supabase
    .from("motorcycle_models")
    .select("id,display_name")
    .is("archived_at", null)
    .order("display_name");
  if (modelError)
    throw Error("Motorcycle compatibility options could not be loaded.");
  const { data: compatibilityUnits, error: unitError } = await supabase
    .from("motorcycle_units")
    .select(
      "id,motorcycle_model_id,internal_unit_code,registration_plate,status",
    )
    .is("archived_at", null)
    .order("internal_unit_code");
  if (unitError) throw Error("Motorcycle units could not be loaded.");
  const { error: compatibilityError } = await supabase
    .from("booking_extras_catalog")
    .select("compatible_unit_ids")
    .limit(0);
  const compatibilityReady = !compatibilityError;

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
          Booking catalog
        </p>
        <h1 className="mt-2 text-4xl font-extrabold text-deep-teal">
          Optional extras
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Add helmets, raincoats, back boxes and other accessories. Set their
          prices, quantities and which bikes can use them.
        </p>
      </header>
      {flash.saved && (
        <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
          Extra saved.
        </p>
      )}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-deep-teal">
          <PackagePlus className="size-5 text-ocean" />
          Add an extra
        </h2>
        <ExtraForm
          models={compatibilityModels ?? []}
          units={compatibilityUnits ?? []}
          compatibilityReady={compatibilityReady}
        />
      </section>
      {!extras?.length && (
        <EmptyState
          title="No extras in the catalog"
          description="Use the form above to add an approved rental extra."
        />
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {extras?.map((extra) => (
          <section
            key={extra.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="admin-extra-summary">
              {extra.image_path ? (
                <Image
                  unoptimized
                  src={
                    supabase.storage
                      .from("booking-extras")
                      .getPublicUrl(extra.image_path).data.publicUrl
                  }
                  width={72}
                  height={72}
                  alt={extra.name}
                />
              ) : (
                <span className="admin-extra-placeholder">
                  <PackagePlus aria-hidden="true" />
                </span>
              )}
              <div>
                <h2>{extra.name}</h2>
                <p>
                  {formatPHP(extra.price_php)} ·{" "}
                  {extra.pricing_model.replaceAll("_", " ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    value={extra.is_active ? "active" : "inactive"}
                  />
                  <StatusBadge
                    value={extra.is_available ? "available" : "unavailable"}
                  />
                </div>
                {extra.description && <p>{extra.description}</p>}
              </div>
            </div>
            <dl className="admin-mini-metrics mt-5">
              <div>
                <dt>Inventory quantity</dt>
                <dd>{extra.total_quantity}</dd>
              </div>
              <div>
                <dt>Per booking limit</dt>
                <dd>{extra.max_per_booking}</dd>
              </div>
            </dl>
            <details className="admin-extra-editor">
              <summary>Edit extra</summary>
              <ExtraForm
                extra={extra}
                models={compatibilityModels ?? []}
                units={compatibilityUnits ?? []}
                compatibilityReady={compatibilityReady}
              />
            </details>
          </section>
        ))}
      </div>
    </div>
  );
}
