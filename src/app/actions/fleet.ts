"use server";
import { checkedQuery } from "@/lib/query-results";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { catalogUploadError } from "@/lib/catalog-upload";
import { AdminActionError } from "@/lib/admin-action-error";

const optionalText = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().max(5000).nullable(),
);
const optionalNumber = z.preprocess(
  (value) => (value === "" ? null : Number(value)),
  z.number().positive().nullable(),
);
const modelSchema = z.object({
  id: z.uuid().optional(),
  brand: z.string().trim().min(1).max(80),
  modelName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(160),
  generation: optionalText,
  modelYear: optionalText,
  engineCc: z.preprocess(
    (v) => (v === "" ? null : Number(v)),
    z.number().int().positive().nullable(),
  ),
  category: optionalText,
  transmission: optionalText,
  exactModelName: optionalText,
  fuelTankCapacity: optionalNumber,
  coolingSystem: optionalText,
  startingSystem: optionalText,
  brakingSystem: optionalText,
  specificationStatus: z.enum(["verified", "reference_only", "pending"]),
  specificationNote: z.string().trim().min(1).max(2000),
  specificationSourceUrl: z.preprocess(
    (value) => (value === "" ? null : value),
    z.url().nullable(),
  ),
  dailyRate: z.coerce.number().int().nonnegative(),
  hourlyRate: z.preprocess(
    (v) => (v === undefined ? undefined : v === "" ? null : Number(v)),
    z.number().int().positive().nullable().optional(),
  ),
  weeklyRate: optionalNumber,
  monthlyRate: optionalNumber,
  description: optionalText,
  features: z.string().max(5000),
  published: z.string().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function audit(
  session: Awaited<ReturnType<typeof requireAdmin>>,
  action: string,
  entityType: string,
  entityId: string,
  metadata = {},
) {
  const { error } = await session.supabase
    .from("audit_logs")
    .insert({
      actor_user_id: session.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    })
    .then(checkedQuery);
  if (error)
    throw new Error(
      `The change succeeded but its audit log failed: ${error.message}`,
    );
}

async function syncRate(
  session: Awaited<ReturnType<typeof requireAdmin>>,
  modelId: string,
  type: "weekly" | "monthly",
  value: number | null,
) {
  const { data: existing } = await session.supabase
    .from("pricing_rules")
    .select("id")
    .eq("motorcycle_model_id", modelId)
    .eq("pricing_type", type)
    .maybeSingle()
    .then(checkedQuery);
  if (value === null) {
    if (existing)
      await session.supabase
        .from("pricing_rules")
        .delete()
        .eq("id", existing.id)
        .then(checkedQuery);
    return;
  }
  const row = {
    motorcycle_model_id: modelId,
    rule_name: `${type[0].toUpperCase()}${type.slice(1)} rate`,
    pricing_type: type,
    amount_php: value,
    is_active: true,
  };
  const result = existing
    ? await session.supabase
        .from("pricing_rules")
        .update(row)
        .eq("id", existing.id)
    : await session.supabase
        .from("pricing_rules")
        .insert(row)
        .then(checkedQuery);
  if (result.error) throw new Error(result.error.message);
}

export async function saveModel(formData: FormData) {
  const parsed = modelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    throw new Error("Please check the model fields and rates.");
  const session = await requireAdmin();
  const d = parsed.data;
  const values = {
    brand: d.brand,
    model_name: d.modelName,
    display_name: d.displayName,
    generation: d.generation,
    model_year: d.modelYear,
    engine_cc: d.engineCc,
    category: d.category,
    transmission: d.transmission,
    exact_model_name: d.exactModelName,
    fuel_tank_capacity_liters: d.fuelTankCapacity,
    cooling_system: d.coolingSystem,
    starting_system: d.startingSystem,
    braking_system: d.brakingSystem,
    specification_status: d.specificationStatus,
    specification_note: d.specificationNote,
    specification_source_url: d.specificationSourceUrl,
    daily_rate_php: d.dailyRate,
    ...(formData.has("hourlyRate") && (d.id || d.hourlyRate != null)
      ? { hourly_extension_rate_php: d.hourlyRate ?? null }
      : {}),
    is_published: d.published === "on",
    description: d.description,
    notable_features: d.features
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
  };
  let id = d.id;
  if (id) {
    const { error } = await session.supabase
      .from("motorcycle_models")
      .update(values)
      .eq("id", id)
      .then(checkedQuery);
    if (error) throw new Error(error.message);
    await audit(session, "model.updated", "motorcycle_model", id);
  } else {
    const slug = `${slugify(d.displayName) || "motorcycle"}-${randomUUID().slice(0, 8)}`;
    const { data, error } = await session.supabase
      .from("motorcycle_models")
      .insert({ ...values, slug })
      .select("id")
      .single()
      .then(checkedQuery);
    if (error) throw new Error(error.message);
    id = data.id;
    await audit(session, "model.created", "motorcycle_model", id);
  }
  await syncRate(session, id, "weekly", d.weeklyRate);
  await syncRate(session, id, "monthly", d.monthlyRate);
  revalidatePath("/dashboard/fleet");
  revalidatePath("/motorcycles", "layout");
  redirect(`/dashboard/fleet/${id}?saved=1`);
}

export async function setModelPublication(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const publish = formData.get("publish") === "true";
  const session = await requireAdmin();
  const { error } = await session.supabase
    .from("motorcycle_models")
    .update({ is_published: publish })
    .eq("id", id)
    .is("archived_at", null)
    .then(checkedQuery);
  if (error) throw new Error(error.message);
  await audit(
    session,
    publish ? "model.published" : "model.unpublished",
    "motorcycle_model",
    id,
  );
  revalidatePath("/dashboard/fleet");
  revalidatePath("/motorcycles", "layout");
}

export async function archiveModel(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const session = await requireAdmin();
  const { error } = await session.supabase
    .from("motorcycle_models")
    .update({ archived_at: new Date().toISOString(), is_published: false })
    .eq("id", id)
    .then(checkedQuery);
  if (error) throw new Error(error.message);
  await audit(session, "model.archived", "motorcycle_model", id);
  revalidatePath("/dashboard/fleet");
  redirect("/dashboard/fleet");
}

export async function saveInventoryQuantity(
  _previous: { error: string; saved: boolean },
  formData: FormData,
): Promise<{ error: string; saved: boolean }> {
  void _previous;
  void formData;
  await requireAdmin();
  return {
    error:
      "Add or edit individual motorcycle units in the inventory section. Quantity changes are disabled.",
    saved: false,
  };
}

export async function uploadMedia(formData: FormData) {
  const session = await requireAdmin();
  const modelId = z.uuid().parse(formData.get("modelId"));
  const alt = z.string().trim().min(5).max(240).parse(formData.get("alt"));
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const validationError = catalogUploadError(files);
  if (validationError) throw new AdminActionError(validationError);
  const { count } = await session.supabase
    .from("motorcycle_media")
    .select("id", { count: "exact", head: true })
    .eq("motorcycle_model_id", modelId)
    .then(checkedQuery);
  const primaryIndex = Number(formData.get("primaryIndex") ?? 0);
  const shouldSetPrimary = count === 0 || formData.get("setPrimary") === "on";
  if (shouldSetPrimary)
    await session.supabase
      .from("motorcycle_media")
      .update({ is_primary: false })
      .eq("motorcycle_model_id", modelId)
      .then(checkedQuery);
  for (const [index, file] of files.entries()) {
    const ext =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${modelId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await session.supabase.storage
      .from("motorcycle-catalog")
      .upload(path, file, { contentType: file.type, upsert: false })
      .then(checkedQuery);
    if (uploadError) throw new Error(uploadError.message);
    const { data, error } = await session.supabase
      .from("motorcycle_media")
      .insert({
        motorcycle_model_id: modelId,
        storage_path: path,
        alt_text: files.length > 1 ? `${alt} ${index + 1}` : alt,
        sort_order: (count ?? 0) + index,
        is_primary: shouldSetPrimary && index === primaryIndex,
        license_status: "business_owned",
        license_source_url:
          "https://kjmmotorcyclerental.com/business-owned-media",
        license_note:
          "Uploaded by an authenticated KJM administrator as business-owned media.",
        verification_status: "verified",
        media_kind: "photo",
      })
      .select("id")
      .single()
      .then(checkedQuery);
    if (error) {
      await session.supabase.storage
        .from("motorcycle-catalog")
        .remove([path])
        .then(checkedQuery);
      throw new Error(error.message);
    }
    await audit(session, "media.uploaded", "motorcycle_media", data.id, {
      modelId,
      path,
    });
  }
  revalidatePath(`/dashboard/fleet/${modelId}`);
  revalidatePath("/motorcycles", "layout");
}

export async function setPrimaryMedia(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const modelId = z.uuid().parse(formData.get("modelId"));
  const session = await requireAdmin();
  await session.supabase
    .from("motorcycle_media")
    .update({ is_primary: false })
    .eq("motorcycle_model_id", modelId)
    .then(checkedQuery);
  const { error } = await session.supabase
    .from("motorcycle_media")
    .update({ is_primary: true })
    .eq("id", id)
    .then(checkedQuery);
  if (error) throw new Error(error.message);
  await audit(session, "media.primary_set", "motorcycle_media", id, {
    modelId,
  });
  revalidatePath(`/dashboard/fleet/${modelId}`);
  revalidatePath("/motorcycles", "layout");
}

export async function deleteMedia(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const modelId = z.uuid().parse(formData.get("modelId"));
  const session = await requireAdmin();
  const { data } = await session.supabase
    .from("motorcycle_media")
    .select("storage_path, is_primary")
    .eq("id", id)
    .single()
    .then(checkedQuery);
  if (!data) throw new Error("Media not found.");
  const { error } = await session.supabase.storage
    .from("motorcycle-catalog")
    .remove([data.storage_path])
    .then(checkedQuery);
  if (error) throw new Error(error.message);
  const { error: rowError } = await session.supabase
    .from("motorcycle_media")
    .delete()
    .eq("id", id)
    .then(checkedQuery);
  if (rowError) throw new Error(rowError.message);
  if (data.is_primary) {
    const { data: next } = await session.supabase
      .from("motorcycle_media")
      .select("id")
      .eq("motorcycle_model_id", modelId)
      .order("sort_order")
      .limit(1)
      .maybeSingle()
      .then(checkedQuery);
    if (next)
      await session.supabase
        .from("motorcycle_media")
        .update({ is_primary: true })
        .eq("id", next.id)
        .then(checkedQuery);
  }
  await audit(session, "media.deleted", "motorcycle_media", id, { modelId });
  revalidatePath(`/dashboard/fleet/${modelId}`);
  revalidatePath("/motorcycles", "layout");
}

export async function moveMedia(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const modelId = z.uuid().parse(formData.get("modelId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const session = await requireAdmin();
  const { data, error } = await session.supabase
    .from("motorcycle_media")
    .select("id, sort_order")
    .eq("motorcycle_model_id", modelId)
    .order("sort_order")
    .then(checkedQuery);
  if (error) throw new Error(error.message);
  const index = data.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= data.length) return;
  await session.supabase
    .from("motorcycle_media")
    .update({ sort_order: data[target].sort_order })
    .eq("id", id)
    .then(checkedQuery);
  await session.supabase
    .from("motorcycle_media")
    .update({ sort_order: data[index].sort_order })
    .eq("id", data[target].id)
    .then(checkedQuery);
  await audit(session, "media.reordered", "motorcycle_media", id, {
    direction,
  });
  revalidatePath(`/dashboard/fleet/${modelId}`);
}
