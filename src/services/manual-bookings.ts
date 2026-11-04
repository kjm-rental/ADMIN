import "server-only";
import { requireAdmin } from "@/lib/auth";
import type { ManualOptions } from "@/lib/manual-booking";

export async function getManualBookingOptions(): Promise<ManualOptions> {
  const { supabase } = await requireAdmin();
  const [models, media, extras, delivery, ready] = await Promise.all([
    supabase
      .from("motorcycle_models")
      .select("id,display_name,daily_rate_php")
      .is("archived_at", null)
      .eq("is_published", true)
      .order("display_name"),
    supabase
      .from("motorcycle_media")
      .select("motorcycle_model_id,storage_path")
      .order("is_primary", { ascending: false })
      .order("sort_order"),
    supabase
      .from("booking_extras_catalog")
      .select("*")
      .eq("is_active", true)
      .eq("is_available", true)
      .gt("total_quantity", 0)
      .order("display_order"),
    (
      supabase.rpc.bind(supabase) as unknown as (
        name: string,
      ) => Promise<{ data: unknown; error: unknown }>
    )("get_delivery_options"),
    supabase.from("bookings").select("manual_adjustment_php").limit(0),
  ]);
  if (models.error || media.error || extras.error || delivery.error)
    throw Error(
      "Booking options could not be loaded. Check the existing catalog and delivery migrations.",
    );
  return {
    ready: !ready.error,
    models: (models.data ?? []).map((m) => {
      const photo = media.data?.find((p) => p.motorcycle_model_id === m.id);
      return {
        ...m,
        image: photo
          ? supabase.storage
              .from("motorcycle-catalog")
              .getPublicUrl(photo.storage_path).data.publicUrl
          : null,
      };
    }),
    extras: (extras.data ?? []).map((e) => ({
      ...e,
      compatible_model_ids:
        (e as typeof e & { compatible_model_ids?: string[] })
          .compatible_model_ids ?? [],
    })),
    delivery: delivery.data as ManualOptions["delivery"],
  };
}
