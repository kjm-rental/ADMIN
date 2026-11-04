"use server";

import { z } from "zod";
import { getFreshAdminSession } from "@/lib/auth";
import { businessTimestamp } from "@/lib/business-time";
import { normalizeMotorcycleColor } from "@/lib/motorcycle-color";
import type { ManualQuote } from "@/lib/manual-booking";

export async function getManualBookingUnits(input: {
  modelId: string;
  startAt: string;
  endAt: string;
  bookingId?: string | null;
}): Promise<{ units: ManualQuote["units"]; error?: string }> {
  const session = await getFreshAdminSession();
  if (!session)
    return { units: [], error: "Active administrator access required." };
  try {
    const d = z
      .object({
        modelId: z.uuid(),
        startAt: z.string().max(40),
        endAt: z.string().max(40),
        bookingId: z.uuid().nullable().optional(),
      })
      .parse(input);
    const start = businessTimestamp(d.startAt),
      end = businessTimestamp(d.endAt);
    if (
      Date.parse(start) <= Date.now() ||
      Date.parse(end) - Date.parse(start) < 86400000
    )
      return {
        units: [],
        error: "Choose a future rental period of at least 24 hours.",
      };
    const db = session.supabase;
    const units = await db
      .from("motorcycle_units")
      .select("id,internal_unit_code,registration_plate,color")
      .eq("motorcycle_model_id", d.modelId)
      .eq("status", "available")
      .is("archived_at", null)
      .order("internal_unit_code");
    if (units.error) throw Error();
    if (!units.data?.length) return { units: [] };
    const ids = units.data.map((u) => u.id);
    let bookings = db
      .from("bookings")
      .select("motorcycle_unit_id")
      .in("motorcycle_unit_id", ids)
      .in("status", ["submitted", "pending", "confirmed", "active"])
      .lt("start_at", end)
      .gt("end_at", start);
    let holds = db
      .from("booking_inventory_holds")
      .select("motorcycle_unit_id")
      .in("motorcycle_unit_id", ids)
      .is("released_at", null)
      .is("converted_at", null)
      .gt("expires_at", new Date().toISOString())
      .lt("start_at", end)
      .gt("end_at", start);
    if (d.bookingId) {
      bookings = bookings.neq("id", d.bookingId);
      holds = holds.neq("booking_id", d.bookingId);
    }
    const [reserved, held, maintenance] = await Promise.all([
      bookings,
      holds,
      db
        .from("motorcycle_unavailability")
        .select("motorcycle_unit_id")
        .in("motorcycle_unit_id", ids)
        .lt("start_at", end)
        .gt("end_at", start),
    ]);
    if (reserved.error || held.error || maintenance.error) throw Error();
    const blocked = new Set(
      [
        ...(reserved.data ?? []),
        ...(held.data ?? []),
        ...(maintenance.data ?? []),
      ].map((r) => r.motorcycle_unit_id),
    );
    return {
      units: units.data
        .filter((u) => !blocked.has(u.id))
        .map((u) => ({
          id: u.id,
          code: u.internal_unit_code,
          plate: u.registration_plate,
          color: u.color ? normalizeMotorcycleColor(u.color) || null : null,
        })),
    };
  } catch {
    return {
      units: [],
      error:
        "Unit availability could not be loaded. Check the dates and try again.",
    };
  }
}
