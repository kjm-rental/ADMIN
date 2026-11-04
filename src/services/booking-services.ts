import { requireAdmin } from "@/lib/auth";
export type ServiceLeg = {
  address: string;
  areaName?: string;
  hotel?: string;
  landmark?: string;
  mapsUrl?: string;
  instructions?: string;
  scheduledAt: string;
};
export type BookingServices = {
  booking_id: string;
  delivery: ServiceLeg | null;
  collection: ServiceLeg | null;
  delivery_fee_centavos: number;
  collection_fee_centavos: number;
  payment_method: "cash" | "qrph";
};
export async function getBookingServices(
  ids: string[],
): Promise<BookingServices[]> {
  if (!ids.length) return [];
  const { supabase } = await requireAdmin();
  const db = supabase as unknown as {
    from: (n: string) => {
      select: (c: string) => {
        in: (
          c: string,
          ids: string[],
        ) => Promise<{
          data: BookingServices[] | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };
  const result = await db
    .from("booking_services")
    .select("*")
    .in("booking_id", ids);
  if (result.error) {
    if (["42P01", "PGRST205"].includes(result.error.code ?? "")) return [];
    throw Error("Booking service details could not be loaded.");
  }
  return result.data ?? [];
}
