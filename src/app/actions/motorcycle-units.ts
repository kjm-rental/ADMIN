"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AdminActionError } from "@/lib/admin-action-error";
import {
  normalizeLicensePlate,
  normalizeMotorcycleColor,
  validLicensePlate,
} from "@/lib/motorcycle-color";

export async function saveMotorcycleUnit(form: FormData) {
  const { supabase, user } = await requireAdmin();
  const modelId = z.uuid().parse(form.get("modelId"));
  const id = z
    .uuid()
    .nullable()
    .parse(form.get("unitId") || null);
  const plateInput = z.string().max(100).parse(form.get("plate"));
  const colorInput = z.string().max(100).parse(form.get("color"));
  const { data: model, error: modelError } = await supabase
    .from("motorcycle_models")
    .select("id")
    .eq("id", modelId)
    .is("archived_at", null)
    .maybeSingle();
  if (modelError || !model)
    throw new AdminActionError("Choose an existing active motorcycle model.");
  const existing = id
    ? await supabase
        .from("motorcycle_units")
        .select("*")
        .eq("id", id)
        .eq("motorcycle_model_id", modelId)
        .is("archived_at", null)
        .single()
    : null;
  if (id && (existing?.error || !existing?.data))
    throw new AdminActionError("Unit could not be loaded. Refresh and retry.");
  // Leave unchanged legacy fields byte-for-byte intact, even when incomplete.
  const plateChanged =
    !id || plateInput !== (existing?.data?.registration_plate ?? "");
  const colorChanged = !id || colorInput !== (existing?.data?.color ?? "");
  const plate = plateChanged
    ? normalizeLicensePlate(plateInput) || null
    : existing!.data!.registration_plate;
  const color = colorChanged
    ? normalizeMotorcycleColor(colorInput) || null
    : existing!.data!.color;
  if ((!id && !plate) || (plateChanged && plate && !validLicensePlate(plate)))
    throw new AdminActionError(
      "Enter a license plate using 2–20 letters, numbers, spaces or hyphens.",
    );
  if (
    (!id && !color) ||
    (color && !/^[\p{L}\p{N}][\p{L}\p{N} /&().'-]{0,99}$/u.test(color))
  )
    throw new AdminActionError(
      "Enter a motorcycle color, such as White / Black, or a custom color.",
    );
  const result = id
    ? await supabase
        .from("motorcycle_units")
        .update({ registration_plate: plate, color })
        .eq("id", id)
        .eq("motorcycle_model_id", modelId)
        .select("id")
        .single()
    : await supabase
        .from("motorcycle_units")
        .insert({
          motorcycle_model_id: modelId,
          internal_unit_code: `KJM-${randomUUID()}`,
          registration_plate: plate,
          color,
          status: "available",
        })
        .select("id")
        .single();
  if (result.error)
    throw new AdminActionError(
      result.error.code === "23505"
        ? "This license plate is already registered. Check existing and archived units."
        : "Unit could not be saved. Refresh and check the inventory schema.",
    );
  const audit = await supabase
    .from("audit_logs")
    .insert({
      actor_user_id: user.id,
      action: id ? "unit.updated" : "unit.created",
      entity_type: "motorcycle_units",
      entity_id: result.data.id,
      metadata: { motorcycle_model_id: modelId },
    });
  revalidatePath(`/dashboard/fleet/${modelId}`);
  revalidatePath("/dashboard/fleet");
  if (audit.error)
    throw new AdminActionError(
      "Unit saved, but the audit log failed. Refresh before retrying.",
    );
}
