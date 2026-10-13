import { ActionForm } from "@/components/action-form";
import { checkedQueries } from "@/lib/query-results";
import { inventorySummary } from "@/lib/inventory";
import { ConfirmButton } from "@/components/confirm-button";
import Image from "next/image";
import Link from "next/link";
import { Bike, Pencil, Plus, Search, Wrench } from "lucide-react";
import { archiveModel } from "@/app/actions/fleet";
import { requireAdmin } from "@/lib/auth";

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const filters = await searchParams;
  const { supabase } = await requireAdmin();
  const [
    { data: models, error },
    { data: units },
    { data: media },
    { data: commitments, error: commitmentsError },
    { data: holds, error: holdsError },
  ] = await Promise.all([
    supabase.from("motorcycle_models").select("*").is("archived_at", null),
    supabase
      .from("motorcycle_units")
      .select("id,motorcycle_model_id,status")
      .is("archived_at", null),
    supabase
      .from("motorcycle_media")
      .select("motorcycle_model_id,storage_path,is_primary,sort_order")
      .order("sort_order"),
    supabase.from("bookings").select("motorcycle_unit_id,status"),
    supabase
      .from("booking_inventory_holds")
      .select("motorcycle_unit_id,expires_at,released_at,converted_at"),
  ]).then(checkedQueries);
  if (error) throw new Error(error.message);
  const q = (filters.q ?? "").trim().toLowerCase();
  const status = filters.status ?? "all";
  const sort = filters.sort ?? "price-asc";
  const filtered = (models ?? [])
    .filter(
      (m) =>
        (!q ||
          `${m.brand} ${m.model_name} ${m.display_name} ${m.generation ?? ""}`
            .toLowerCase()
            .includes(q)) &&
        (status === "all" ||
          (status === "published" ? m.is_published : !m.is_published)),
    )
    .sort((a, b) =>
      sort === "price-desc"
        ? b.daily_rate_php - a.daily_rate_php
        : sort === "name"
          ? a.display_name.localeCompare(b.display_name)
          : a.daily_rate_php - b.daily_rate_php,
    );
  const perPage = 6,
    totalPages = Math.max(1, Math.ceil(filtered.length / perPage)),
    page = Math.min(totalPages, Math.max(1, Number(filters.page) || 1)),
    visible = filtered.slice((page - 1) * perPage, page * perPage);
  const pageHref = (next: number) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (status !== "all") p.set("status", status);
    if (sort !== "price-asc") p.set("sort", sort);
    p.set("page", String(next));
    return `?${p}`;
  };
  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold tracking-[.16em] text-ocean uppercase">
            Fleet Management
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-deep-teal sm:text-4xl">
            Motorcycle catalog
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage public models separately from private physical units.
          </p>
        </div>
        <Link
          href="/dashboard/fleet/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ocean px-4 py-2.5 text-sm font-bold text-white shadow-sm"
        >
          <Plus className="size-4" />
          Add motorcycle
        </Link>
      </header>
      <form className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search fleet</span>
          <Search className="absolute top-3.5 left-3.5 size-4 text-slate-400" />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search brand, model, or generation"
            className="min-h-11 w-full rounded-xl border border-slate-200 pr-3 pl-10 text-sm outline-none focus:border-ocean"
          />
        </label>
        <select
          name="status"
          defaultValue={status}
          aria-label="Publication status"
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          name="sort"
          defaultValue={sort}
          aria-label="Sort fleet"
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
        <button className="rounded-xl bg-deep-teal px-5 text-sm font-bold text-white">
          Apply
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">
          {filtered.length} model{filtered.length === 1 ? "" : "s"}
        </p>
        {(q || status !== "all" || sort !== "price-asc") && (
          <Link
            href="/dashboard/fleet"
            className="text-xs font-bold text-ocean"
          >
            Clear filters
          </Link>
        )}
      </div>
      {!visible.length ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Bike className="mx-auto size-8 text-slate-300" />
          <p className="mt-4 text-sm font-bold text-deep-teal">
            No motorcycle models match this view.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Adjust the filters or create a new model.
          </p>
        </div>
      ) : (
        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((model) => {
            const modelUnits =
              units?.filter((u) => u.motorcycle_model_id === model.id) ?? [];
            const summary = inventorySummary(
              modelUnits,
              commitments ?? [],
              holds ?? [],
            );
            const maintenance = modelUnits.filter(
              (u) => u.status === "maintenance",
            ).length;
            const cover = media
              ?.filter((m) => m.motorcycle_model_id === model.id)
              .sort(
                (a, b) =>
                  Number(b.is_primary) - Number(a.is_primary) ||
                  a.sort_order - b.sort_order,
              )[0];
            const url = cover
              ? supabase.storage
                  .from("motorcycle-catalog")
                  .getPublicUrl(cover.storage_path).data.publicUrl
              : null;
            return (
              <article key={model.id} className="admin-fleet-card">
                <div className="admin-fleet-photo">
                  {url ? (
                    <Image
                      src={url}
                      alt={`${model.display_name} catalog image`}
                      fill
                      sizes="(max-width:768px) 100vw,33vw"
                      className="object-contain p-5"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-500">
                      <Bike className="size-9" />
                      <span className="mt-2 text-[10px] font-bold tracking-wider uppercase">
                        Photo required
                      </span>
                    </div>
                  )}
                  <span
                    className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase shadow-sm ${model.is_published ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500"}`}
                  >
                    {model.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-extrabold tracking-wider text-ocean uppercase">
                    {model.brand}
                    {model.generation ? ` · ${model.generation}` : ""}
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-deep-teal">
                    {model.display_name}
                  </h2>
                  <p className="mt-3 text-xl font-extrabold text-ocean">
                    ₱{model.daily_rate_php.toLocaleString("en-PH")}
                    <span className="text-xs font-semibold text-slate-400">
                      /day
                    </span>
                  </p>
                  <div className="mt-4 flex gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <span>
                      {modelUnits.length} unit
                      {modelUnits.length === 1 ? "" : "s"}
                    </span>
                    {maintenance > 0 && (
                      <span className="flex items-center gap-1 font-bold text-amber-700">
                        <Wrench className="size-3" />
                        {maintenance} maintenance
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {commitmentsError || holdsError
                      ? "Availability could not be loaded"
                      : `${summary.available} available · ${summary.reserved} reserved · ${summary.rented} rented`}
                  </p>
                  <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                    <Link
                      href={`/dashboard/fleet/${model.id}`}
                      className="flex items-center justify-center gap-2 rounded-xl bg-deep-teal px-3 py-2.5 text-xs font-bold text-white"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Link>
                    <ActionForm action={archiveModel}>
                      <input type="hidden" name="id" value={model.id} />
                      <ConfirmButton
                        message="Archive this motorcycle model? It will be removed from the active catalog."
                        className="admin-button admin-danger"
                      >
                        Archive
                      </ConfirmButton>
                    </ActionForm>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
      {totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-3"
          aria-label="Fleet pagination"
        >
          <Link
            aria-disabled={page === 1}
            href={pageHref(page - 1)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${page === 1 ? "pointer-events-none text-slate-300" : "bg-white text-deep-teal"}`}
          >
            Previous
          </Link>
          <span className="text-xs font-semibold text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Link
            aria-disabled={page === totalPages}
            href={pageHref(page + 1)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${page === totalPages ? "pointer-events-none text-slate-300" : "bg-white text-deep-teal"}`}
          >
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}
