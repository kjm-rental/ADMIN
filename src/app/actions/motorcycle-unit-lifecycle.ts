"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  unitHistoryMessage,
  type UnitLifecycleState,
} from "@/lib/motorcycle-unit-lifecycle";

export async function manageMotorcycleUnit(
  _previous: UnitLifecycleState,
  form: FormData,
): Promise<UnitLifecycleState> {
  // Authenticate before validation or inventory access, preserving auth redirects.
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({
      modelId: z.uuid(),
      unitId: z.uuid(),
      operation: z.enum(["remove", "deactivate", "reactivate"]),
      expectedStatus: z.enum([
        "available",
        "reserved",
        "rented",
        "maintenance",
        "inactive",
      ]),
      confirmed: z.literal("yes"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      outcome: "error",
      message: "Review the unit and confirm the action before continuing.",
    };
  const d = parsed.data;
  let result;
  try {
    result = await supabase.rpc("admin_manage_motorcycle_unit", {
      p_model_id: d.modelId,
      p_unit_id: d.unitId,
      p_operation: d.operation,
      p_expected_status: d.expectedStatus,
    });
  } catch {
    return {
      outcome: "error",
      message:
        "The connection was interrupted. Refresh the inventory to check the unit before retrying.",
    };
  }
  if (result.error) {
    const code = result.error.code;
    return {
      outcome: code === "23503" ? "history" : "error",
      message:
        code === "23503"
          ? unitHistoryMessage
          : ["PGRST202", "42883", "42P01"].includes(code)
            ? "The unit removal SQL must be reviewed and applied before using these controls."
            : ["55P03", "40P01", "40001"].includes(code)
              ? "Inventory is busy with another operation. Refresh and retry."
              : code === "42501"
                ? "Active administrator access is required."
                : "The unit could not be changed. Refresh the inventory and try again. No success was confirmed.",
    };
  }
  const response = z
    .object({
      outcome: z.enum([
        "removed",
        "deactivated",
        "reactivated",
        "history",
        "blocked",
        "stale",
        "not_found",
      ]),
    })
    .safeParse(result.data);
  if (!response.success)
    return {
      outcome: "error",
      message:
        "The result could not be verified. Refresh the inventory before retrying.",
    };
  const outcome = response.data.outcome;
  if (outcome === "history") return { outcome, message: unitHistoryMessage };
  if (outcome === "blocked")
    return {
      outcome,
      message:
        "This motorcycle has unresolved reservations, a live inventory hold, or an active rental. Resolve those reservations or rental records before deactivating it. Nothing was cancelled or reassigned.",
    };
  if (outcome === "stale" || outcome === "not_found")
    return {
      outcome: "error",
      message:
        "This unit changed or is no longer on this model. Refresh the inventory before continuing.",
    };
  revalidatePath(`/dashboard/fleet/${d.modelId}`);
  revalidatePath("/dashboard/fleet");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  // A page-level flash survives removal of the unit's component from the list.
  redirect(`/dashboard/fleet/${d.modelId}?unitAction=${outcome}#inventory`);
}
