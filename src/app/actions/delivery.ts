"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
import { AdminActionError } from "@/lib/admin-action-error";
export async function saveDelivery(form: FormData) {
  const session = await getFreshAdminSession();
  if (!session) throw new AdminActionError("Administrator access required.");
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as (
    n: string,
    a: Record<string, unknown>,
  ) => Promise<{ error: unknown }>;
  const mode = form.get("mode");
  let result;
  if (mode === "settings") {
    const clock = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/);
    const values = {
      enabled: form.get("enabled") === "on",
      delivery_open: clock.parse(form.get("delivery_open")),
      delivery_close: clock.parse(form.get("delivery_close")),
      collection_open: clock.parse(form.get("collection_open")),
      collection_close: clock.parse(form.get("collection_close")),
      cash_enabled: form.get("cash_enabled") === "on",
      qrph_enabled: form.get("qrph_enabled") === "on",
    };
    if (
      values.qrph_enabled &&
      process.env.NEXT_PUBLIC_QRPH_LIVE_VERIFIED !== "true"
    )
      throw new AdminActionError(
        "Live QRPh verification is required before activation.",
      );
    result = await rpc("admin_save_delivery_settings", { p_values: values });
  } else {
    const id = z
      .uuid()
      .nullable()
      .parse(form.get("id") || null);
    const remove = form.get("remove") === "yes";
    const values = remove
      ? {}
      : {
          name: z.string().trim().min(2).max(120).parse(form.get("name")),
          delivery_php: z.coerce
            .number()
            .int()
            .min(0)
            .max(100000)
            .parse(form.get("delivery_php")),
          collection_php: z.coerce
            .number()
            .int()
            .min(0)
            .max(100000)
            .parse(form.get("collection_php")),
          enabled: form.get("enabled") === "on",
        };
    result = await rpc("admin_save_delivery_area", {
      p_id: id,
      p_values: values,
      p_remove: remove,
    });
  }
  if (result.error)
    throw new AdminActionError(
      "Could not save. Check service hours, fees and payment availability. An area used by a booking cannot be removed; disable it instead. Migration 037 is required.",
    );
  revalidatePath("/dashboard/settings");
}
