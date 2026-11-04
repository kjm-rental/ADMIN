"use server";
import { AdminActionError } from "@/lib/admin-action-error";
import { getFreshAdminSession } from "@/lib/auth";
import {
  manualBookingSchema,
  type ManualBookingInput,
  type ManualQuote,
  type ManualCustomer,
} from "@/lib/manual-booking";
import { businessTimestamp } from "@/lib/business-time";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function session() {
  const s = await getFreshAdminSession();
  if (!s) throw Error("Active administrator access required.");
  return s;
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { supabase } = await session();
  const call = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
  const result = await call(name, args);
  if (result.error) {
    if (["PGRST202", "42883", "42P01"].includes(result.error.code ?? ""))
      throw Error(
        "Manual booking migration must be reviewed and applied before using this feature.",
      );
    throw new AdminActionError(result.error.message);
  }
  return result.data;
}
function payload(input: unknown) {
  const d = manualBookingSchema.parse(input);
  return {
    ...d,
    startAt: businessTimestamp(d.startAt),
    endAt: businessTimestamp(d.endAt),
  };
}
export async function searchManualCustomers(
  query: string,
): Promise<ManualCustomer[]> {
  const q = z.string().trim().min(2).max(100).parse(query);
  return z
    .array(
      z.object({
        id: z.uuid(),
        full_name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        customer_type: z.string().nullable(),
      }),
    )
    .parse(await rpc("admin_search_manual_customers", { p_query: q }));
}
export async function quoteManualBooking(
  input: unknown,
): Promise<{ quote?: ManualQuote; error?: string }> {
  try {
    // Pricing needs rental choices, not personal details or confirmation consent.
    // Keep the complete schema mandatory in saveManualBooking.
    const shape = manualBookingSchema.shape;
    const d = z
      .object({
        bookingId: shape.bookingId,
        modelId: shape.modelId,
        startAt: shape.startAt,
        endAt: shape.endAt,
        selectedColor: shape.selectedColor,
        services: shape.services,
        extras: shape.extras,
        adjustment: shape.adjustment,
      })
      .parse(input);
    return {
      quote: (await rpc("admin_quote_manual_booking_with_color", {
        p_payload: {
          ...d,
          startAt: businessTimestamp(d.startAt),
          endAt: businessTimestamp(d.endAt),
        },
      })) as ManualQuote,
    };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0]?.message
          : e instanceof Error
            ? e.message
            : "Quote unavailable.",
    };
  }
}
export async function saveManualBooking(
  input: ManualBookingInput,
): Promise<{ bookingId?: string; error?: string }> {
  try {
    const d = payload(input);
    if (d.expectedTotal === undefined || !d.quoteToken)
      throw Error("Review a fresh quote before saving.");
    const result = z
      .object({ bookingId: z.uuid() })
      .parse(
        await rpc("admin_save_manual_booking_with_color", { p_payload: d }),
      );
    for (const path of [
      "/dashboard/bookings",
      "/dashboard/calendar",
      "/dashboard/customers",
      `/dashboard/bookings/${result.bookingId}`,
    ])
      revalidatePath(path);
    return result;
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0]?.message
          : e instanceof Error
            ? e.message
            : "Booking could not be saved. Retry with the same request.",
    };
  }
}

export async function saveManualDrivingDetails(form: FormData) {
  const bookingId = z.uuid().parse(form.get("bookingId"));
  const values = z
    .object({
      identityName: z.string().trim().min(2).max(160),
      licenseName: z.string().trim().min(2).max(160),
      licenseCountry: z.string().trim().min(2).max(100),
      licenseExpiry: z.iso.date(),
      categories: z.string().trim().min(1).max(200),
      entryDate: z.union([z.literal(""), z.iso.date()]),
    })
    .parse(Object.fromEntries(form));
  await rpc("admin_update_manual_driving_details", {
    p_booking: bookingId,
    p_values: values,
  });
  revalidatePath(`/dashboard/bookings/${bookingId}`);
  revalidatePath("/dashboard/verifications");
}
