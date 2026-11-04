export const instant = false;
import { connection } from "next/server";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { checkedQueries } from "@/lib/query-results";
import { ConfirmButton } from "@/components/confirm-button";
import Image from "next/image";
import { MotorcycleUnitForm } from "@/components/motorcycle-unit-form";
import { inventorySummary } from "@/lib/inventory";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveModel,
  deleteMedia,
  moveMedia,
  setModelPublication,
  setPrimaryMedia,
} from "@/app/actions/fleet";
import { MediaUploadForm } from "@/components/media-upload-form";
import { ModelForm } from "@/components/model-form";
import { requireAdmin } from "@/lib/auth";
import { unitLifecycleMessages } from "@/lib/motorcycle-unit-lifecycle";
export default async function ModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; unitAction?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { saved, unitAction } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: model }, { data: rates }, { data: units }, { data: media }] =
    await Promise.all([
      supabase.from("motorcycle_models").select("*").eq("id", id).maybeSingle(),
      supabase.from("pricing_rules").select("*").eq("motorcycle_model_id", id),
      supabase
        .from("motorcycle_units")
        .select("*")
        .eq("motorcycle_model_id", id)
        .is("archived_at", null)
        .order("internal_unit_code"),
      supabase
        .from("motorcycle_media")
        .select("*")
        .eq("motorcycle_model_id", id)
        .order("sort_order"),
    ]).then(checkedQueries);
  if (!model || model.archived_at) notFound();
  const [
    { data: bookings, error: bookingError },
    { data: holds, error: holdError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("motorcycle_unit_id,status")
      .eq("motorcycle_model_id", id)
      .in("status", ["submitted", "pending", "confirmed", "active"]),
    units?.length
      ? supabase
          .from("booking_inventory_holds")
          .select("motorcycle_unit_id,expires_at,released_at,converted_at")
          .in(
            "motorcycle_unit_id",
            (units ?? []).map((u) => u.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]).then(checkedQueries);
  if (bookingError || holdError)
    throw new Error("Inventory commitments could not be loaded.");
  const summary = inventorySummary(units ?? [], bookings ?? [], holds ?? []);
  const weekly = rates?.find((r) => r.pricing_type === "weekly")?.amount_php;
  const monthly = rates?.find((r) => r.pricing_type === "monthly")?.amount_php;
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/fleet" className="text-ocean text-sm font-bold">
        ← Fleet
      </Link>
      {saved === "1" && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
        >
          Motorcycle details saved successfully.
        </p>
      )}
      {unitAction && Object.hasOwn(unitLifecycleMessages, unitAction) && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
        >
          {unitLifecycleMessages[unitAction]}
        </p>
      )}
      <header className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[10px] font-extrabold tracking-[.16em] text-ocean uppercase">
            {model.is_published ? "Published model" : "Draft model"}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-deep-teal">
            {model.display_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Stable public slug: {model.slug}
          </p>
        </div>
        <div className="flex gap-2">
          <ActionForm action={setModelPublication}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="publish"
              value={String(!model.is_published)}
            />
            <SubmitButton
              unstyled
              className="rounded-xl border border-ocean px-4 py-2 text-sm font-bold text-ocean"
            >
              {model.is_published ? "Unpublish" : "Publish"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={archiveModel}>
            <input type="hidden" name="id" value={id} />
            <ConfirmButton
              message="Archive this motorcycle model? It will be removed from the active catalog."
              className="admin-button admin-danger"
            >
              Archive
            </ConfirmButton>
          </ActionForm>
        </div>
      </header>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-extrabold text-deep-teal">
          Model details and pricing
        </h2>
        <ModelForm model={model} weekly={weekly} monthly={monthly} />
      </section>
      <section
        id="inventory"
        className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-extrabold text-deep-teal">
          Motorcycle inventory
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Add each motorcycle manually for {model.display_name}. Plates stay
          private; colors are offered to customers.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(summary).map(([label, count]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold capitalize text-slate-500">
                {label} units
              </dt>
              <dd className="mt-2 text-2xl font-extrabold text-deep-teal">
                {count}
              </dd>
            </div>
          ))}
        </dl>
        <details className="mt-5 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-bold text-ocean">
            Add motorcycle unit · {model.display_name}
          </summary>
          <MotorcycleUnitForm modelId={id} modelName={model.display_name} />
        </details>
        <div className="mt-5 space-y-3">
          {(units ?? []).map((unit) => (
            <details
              key={unit.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {model.display_name} ·{" "}
                {unit.registration_plate || "Plate not configured"} ·{" "}
                {unit.color || "Color not configured"} · {unit.status}
              </summary>
              <MotorcycleUnitForm
                modelId={id}
                modelName={model.display_name}
                unit={unit}
              />
            </details>
          ))}
          {!units?.length && (
            <p className="text-sm text-slate-500">
              No units yet. Add actual motorcycles individually above.
            </p>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Reserved includes future confirmed bookings and live holds, counted
          once per unit. Availability for specific rental dates is checked
          separately by the booking engine.
        </p>
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-extrabold text-deep-teal">
          Approved media
        </h2>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_22rem]">
          <div className="space-y-3">
            {media?.length ? (
              media.map((item, index) => {
                const url = supabase.storage
                  .from("motorcycle-catalog")
                  .getPublicUrl(item.storage_path).data.publicUrl;
                return (
                  <article
                    key={item.id}
                    className="grid grid-cols-[8rem_1fr] gap-4 rounded-2xl bg-white p-4"
                  >
                    <div className="relative h-24 bg-slate-50">
                      <Image
                        src={url}
                        alt={item.alt_text}
                        fill
                        sizes="128px"
                        className="object-contain p-2"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{item.alt_text}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.is_primary ? "Primary · " : ""}Business-owned ·
                        verified
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                        <ActionForm action={setPrimaryMedia}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="modelId" value={id} />
                          <SubmitButton
                            unstyled
                            disabled={item.is_primary}
                            className="text-ocean disabled:text-slate-300"
                          >
                            Set primary
                          </SubmitButton>
                        </ActionForm>
                        {index > 0 && (
                          <ActionForm action={moveMedia}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="modelId" value={id} />
                            <input type="hidden" name="direction" value="up" />
                            <SubmitButton unstyled>Move up</SubmitButton>
                          </ActionForm>
                        )}
                        {index < media.length - 1 && (
                          <ActionForm action={moveMedia}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="modelId" value={id} />
                            <input
                              type="hidden"
                              name="direction"
                              value="down"
                            />
                            <SubmitButton unstyled>Move down</SubmitButton>
                          </ActionForm>
                        )}
                        <ActionForm action={deleteMedia}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="modelId" value={id} />
                          <ConfirmButton
                            message="Delete this catalog image? This cannot be undone."
                            className="admin-danger rounded-lg px-3"
                          >
                            Delete
                          </ConfirmButton>
                        </ActionForm>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No approved media uploaded.
              </div>
            )}
          </div>
          <MediaUploadForm modelId={id} />
        </div>
      </section>
    </div>
  );
}
