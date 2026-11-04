import { ManualDrivingDetails } from "@/components/manual-driving-details";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Panel } from "@/components/admin-ui";
import { ManualBookingForm } from "@/components/manual-booking-form";
import { getManualBookingOptions } from "@/services/manual-bookings";
import { businessDateTimeInput } from "@/lib/business-time";
import {
  adjustmentSchema,
  type ManualBookingInput,
} from "@/lib/manual-booking";
import { ManualBookingDocuments } from "@/components/manual-booking-documents";

async function detail(bookingId: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("booking_admin_details")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error && !["42P01", "PGRST205"].includes(error.code))
    throw Error("Admin booking details could not be loaded.");
  return data;
}
export async function ManualBookingManagement({
  bookingId,
  edit,
}: {
  bookingId: string;
  edit: boolean;
}) {
  const meta = await detail(bookingId);
  if (!meta) return null;
  const { supabase } = await requireAdmin();
  const { data: b, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (error || !b) throw Error("Manual booking could not be loaded.");
  if (edit) {
    const [options, customer, services, extras] = await Promise.all([
      getManualBookingOptions(),
      supabase.from("customers").select("*").eq("id", b.customer_id).single(),
      supabase
        .from("booking_services")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle(),
      supabase
        .from("booking_extra_items")
        .select("extra_id,quantity")
        .eq("booking_id", bookingId),
    ]);
    if (customer.error || services.error || extras.error || !customer.data)
      throw Error("Booking editor could not be loaded.");
    const service = services.data as unknown as {
      delivery: {
        areaId: string;
        address: string;
        instructions?: string;
      } | null;
      collection: {
        areaId: string;
        address: string;
        instructions?: string;
      } | null;
    } | null;
    const c = customer.data;
    const leg = (value: NonNullable<typeof service>["delivery"]) =>
      value
        ? {
            areaId: value.areaId,
            address: value.address,
            instructions: value.instructions ?? "",
          }
        : null;
    const { data: hold, error: holdError } = await supabase
      .from("booking_inventory_holds")
      .select("motorcycle_unit_id")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (holdError) throw Error("Booking hold could not be loaded.");
    const initial: ManualBookingInput = {
      requestId: "",
      bookingId,
      revision: meta.revision,
      customerId: c.id,
      fullName: c.full_name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      customerType:
        c.customer_type === "international_visitor"
          ? "international_visitor"
          : "philippine_resident",
      source: meta.source as ManualBookingInput["source"],
      modelId: b.motorcycle_model_id ?? "",
      selectedColor: b.selected_color,
      unitId: b.motorcycle_unit_id ?? hold?.motorcycle_unit_id ?? "",
      startAt: businessDateTimeInput(b.start_at),
      endAt: businessDateTimeInput(b.end_at),
      services: {
        delivery: leg(service?.delivery ?? null),
        collection: leg(service?.collection ?? null),
      },
      extras: (extras.data ?? []).flatMap((e) =>
        e.extra_id ? [{ id: e.extra_id, quantity: e.quantity }] : [],
      ),
      adjustment: adjustmentSchema.parse(meta.adjustment),
      notes: meta.internal_notes,
      action: b.status === "confirmed" ? "confirmed" : "pending",
      confirmationReason: meta.confirmation_reason,
    };
    return (
      <div className="my-5 space-y-4">
        <Link
          href={`/dashboard/bookings/${bookingId}`}
          className="text-sm font-semibold text-ocean"
        >
          Close admin booking editor
        </Link>
        <ManualBookingForm options={options} initial={initial} />
      </div>
    );
  }
  return (
    <div className="my-5 space-y-4">
      <Panel
        title={`Admin Booking · ${meta.source.replaceAll("_", " ")}`}
        action={
          ["pending", "confirmed"].includes(b.status) ? (
            <Link
              href={`/dashboard/bookings/${bookingId}?tab=manual`}
              className="admin-btn-secondary"
            >
              Edit admin booking
            </Link>
          ) : undefined
        }
      >
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <p>
            Standard rental
            <br />
            <strong>
              ₱
              {(
                b.base_total_php +
                b.extras_total_php +
                ((b as typeof b & { services_total_php?: number })
                  .services_total_php ?? 0)
              ).toLocaleString("en-PH")}
            </strong>
          </p>
          <p>
            Booking adjustment
            <br />
            <strong>
              ₱{(b.manual_adjustment_php ?? 0).toLocaleString("en-PH")}
            </strong>
          </p>
          <p>
            Final rental
            <br />
            <strong>₱{b.quoted_total_php.toLocaleString("en-PH")}</strong>
          </p>
        </div>
        {meta.internal_notes && (
          <p className="mt-3 whitespace-pre-wrap text-sm">
            <strong>Internal notes:</strong> {meta.internal_notes}
          </p>
        )}
        {adjustmentSchema.parse(meta.adjustment).reason && (
          <p className="mt-2 text-sm">
            Price reason: {adjustmentSchema.parse(meta.adjustment).reason}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Reservation confirmation does not approve identity or authorize
          handover. Existing payment, deposit, document review and inspection
          requirements still apply.
        </p>
      </Panel>
      {["pending", "confirmed"].includes(b.status) && (
        <>
          <ManualDrivingDetails bookingId={bookingId} />
          <ManualBookingDocuments bookingId={bookingId} />
        </>
      )}
    </div>
  );
}
