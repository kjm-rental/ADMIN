import { ActionForm } from "@/components/action-form";
import Image from "next/image";
import { StatusBadge, formatPHP, EmptyState } from "@/components/admin-ui";
import { PackagePlus } from "lucide-react";
import { saveExtra } from "@/app/actions/extras";
import { SubmitButton } from "@/components/submit-button";
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
          Manage pricing, images, customer limits, and shared inventory.
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
        <ExtraForm />
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
              <ExtraForm extra={extra} />
            </details>
          </section>
        ))}
      </div>
    </div>
  );
}

type Extra = {
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
function ExtraForm({ extra }: { extra?: Extra }) {
  return (
    <ActionForm action={saveExtra} className="mt-4 grid gap-4 sm:grid-cols-2">
      {extra && <input type="hidden" name="id" value={extra.id} />}
      <label className="text-xs font-bold text-deep-teal">
        Name
        <input
          required
          name="name"
          defaultValue={extra?.name}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>
      <label className="text-xs font-bold text-deep-teal">
        Pricing model
        <select
          name="pricingModel"
          defaultValue={extra?.pricing_model ?? "per_rental"}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        >
          <option value="per_rental">Per rental</option>
          <option value="per_day">Per rental day</option>
        </select>
      </label>
      <label className="text-xs font-bold text-deep-teal">
        Available quantity
        <input
          required
          type="number"
          min="0"
          name="totalQuantity"
          defaultValue={extra?.total_quantity ?? 1}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
        />
      </label>
      <label className="text-xs font-bold text-deep-teal">
        Customer quantity limit
        <input
          required
          type="number"
          min="1"
          name="maxPerBooking"
          defaultValue={extra?.max_per_booking ?? 1}
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
      <label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-deep-teal">
        <input
          type="checkbox"
          name="available"
          defaultChecked={extra?.is_available}
          className="size-4 accent-ocean"
        />
        Available to customers
      </label>
      <SubmitButton className="rounded-xl bg-deep-teal px-4 py-3 text-sm font-bold text-white sm:col-span-2">
        {extra ? "Save changes" : "Create extra"}
      </SubmitButton>
    </ActionForm>
  );
}
