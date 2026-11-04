import { getBookingServices } from "@/services/booking-services";
export const instant = false;
import { connection } from "next/server";
import { calendarPeriod } from "@/lib/calendar-period";
import { checkedQueries } from "@/lib/query-results";
import { ReservationCalendar } from "@/components/reservation-calendar";
import {
  addCalendarDays,
  monthGridKeys,
  shiftCalendarPeriod,
  type CalendarReservation,
} from "@/lib/reservation-calendar";
import { businessTimestamp } from "@/lib/business-time";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  await connection();
  const f = await searchParams,
    { supabase } = await requireAdmin();
  const view = ["day", "week", "month"].includes(f.view ?? "")
    ? (f.view as "day" | "week" | "month")
    : "month";
  const { key, start, end, loadedAt } = calendarPeriod(f.date, view);
  const days =
    view === "month"
      ? monthGridKeys(key)
      : Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
          addCalendarDays(
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Manila",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(start),
            i,
          ),
        );
  const queryStart = businessTimestamp(`${days[0]}T00:00`);
  const queryEnd = businessTimestamp(
    `${addCalendarDays(days.at(-1)!, 1)}T00:00`,
  );
  const [
    { data: bookings },
    { data: blocks },
    { data: units },
    { data: models },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id,booking_reference,customer_id,motorcycle_unit_id,motorcycle_model_id,start_at,end_at,status,handover_at,expires_at,total_centavos",
      )
      .lt("start_at", queryEnd)
      .gte("end_at", queryStart)
      .in("status", [
        "submitted",
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled",
      ]),
    supabase
      .from("motorcycle_unavailability")
      .select("id,motorcycle_unit_id,start_at,end_at,reason")
      .lt("start_at", queryEnd)
      .gte("end_at", queryStart),
    supabase
      .from("motorcycle_units")
      .select("id,internal_unit_code,motorcycle_model_id"),
    supabase.from("motorcycle_models").select("id,display_name"),
  ]).then(checkedQueries);
  const bookingIds = (bookings ?? []).map((b) => b.id);
  const customerIds = [...new Set((bookings ?? []).map((b) => b.customer_id))];
  const [
    { data: customers },
    { data: verifications },
    { data: payments },
    { data: media },
  ] = await Promise.all([
    supabase.from("customers").select("id,full_name").in("id", customerIds),
    supabase
      .from("customer_verifications")
      .select("id,booking_id,overall_status")
      .in("booking_id", bookingIds),
    supabase
      .from("payment_events")
      .select("booking_id,event_type,amount_centavos")
      .in("booking_id", bookingIds),
    supabase
      .from("motorcycle_media")
      .select("motorcycle_model_id,storage_path,is_primary,sort_order")
      .order("sort_order"),
  ]).then(checkedQueries);
  const services = await getBookingServices(bookingIds);
  const events: CalendarReservation[] = [
    ...(bookings ?? [])
      .filter(
        (b) =>
          !(
            ["pending", "submitted"].includes(b.status) &&
            b.expires_at &&
            Date.parse(b.expires_at) <= loadedAt.getTime()
          ),
      )
      .map((b) => ({
        id: b.id,
        reference: b.booking_reference,
        motorcycle:
          models?.find((m) => m.id === b.motorcycle_model_id)?.display_name ??
          "Motorcycle",
        unit:
          units?.find((u) => u.id === b.motorcycle_unit_id)
            ?.internal_unit_code ?? "Unit pending assignment",
        start: b.start_at,
        end: b.end_at,
        status: b.status,
        handoverAt: b.handover_at,
        delivery:
          services.find((service) => service.booking_id === b.id)?.delivery ??
          undefined,
        collection:
          services.find((service) => service.booking_id === b.id)?.collection ??
          undefined,
        modelId: b.motorcycle_model_id ?? undefined,
        customer:
          customers?.find((c) => c.id === b.customer_id)?.full_name ??
          "Customer",
        verification: verifications?.find((v) => v.booking_id === b.id)
          ?.overall_status,
        verificationId: verifications?.find((v) => v.booking_id === b.id)?.id,
        payment: (() => {
          const paid = (payments ?? [])
            .filter((p) => p.booking_id === b.id)
            .reduce(
              (sum, p) =>
                sum +
                (p.event_type === "payment"
                  ? p.amount_centavos
                  : -p.amount_centavos),
              0,
            );
          return paid <= 0
            ? "Unpaid · cash on pickup"
            : paid < b.total_centavos
              ? "Partially paid"
              : "Paid";
        })(),
        imageUrl: (() => {
          const images = (media ?? []).filter(
            (m) => m.motorcycle_model_id === b.motorcycle_model_id,
          );
          const cover = images.find((m) => m.is_primary) ?? images[0];
          return cover
            ? supabase.storage
                .from("motorcycle-catalog")
                .getPublicUrl(cover.storage_path).data.publicUrl
            : undefined;
        })(),
      })),
    ...(blocks ?? []).map((b) => ({
      id: b.id,
      reference: "Maintenance",
      motorcycle:
        models?.find(
          (m) =>
            m.id ===
            units?.find((u) => u.id === b.motorcycle_unit_id)
              ?.motorcycle_model_id,
        )?.display_name ?? "Motorcycle maintenance",
      modelId: units?.find((u) => u.id === b.motorcycle_unit_id)
        ?.motorcycle_model_id,
      unit:
        units?.find((u) => u.id === b.motorcycle_unit_id)?.internal_unit_code ??
        "Unit",
      start: b.start_at,
      end: b.end_at,
      status: "maintenance",
      maintenance: true,
    })),
  ];
  const heading =
    view === "month"
      ? start.toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Manila",
        })
      : view === "day"
        ? start.toLocaleDateString("en-PH", {
            dateStyle: "long",
            timeZone: "Asia/Manila",
          })
        : `${start.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })} – ${new Date(end.getTime() - 1).toLocaleDateString("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" })}`;
  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-extrabold tracking-wider text-ocean uppercase">
        Schedule
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-deep-teal">
            Reservation calendar
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Plan pickups, follow active rentals, and see what needs attention.
            Select a reservation to see its details.
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {["day", "week", "month"].map((v) => (
            <Link
              key={v}
              href={`?view=${v}&date=${key}`}
              aria-current={view === v ? "page" : undefined}
              className={`min-h-11 inline-flex items-center rounded-lg px-3 py-2 text-xs font-bold capitalize ${view === v ? "bg-deep-teal text-white" : "text-slate-500"}`}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>
      <div className="admin-calendar-toolbar mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <Link
          href={`?view=${view}&date=${shiftCalendarPeriod(key, view, -1)}`}
          className="text-sm font-bold text-ocean"
        >
          ← Previous
        </Link>
        <p className="font-extrabold text-deep-teal">{heading}</p>
        <Link
          href={`?view=${view}&date=${shiftCalendarPeriod(key, view, 1)}`}
          className="text-sm font-bold text-ocean"
        >
          Next →
        </Link>
      </div>
      <div className="my-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <Link
          href={`?view=${view}`}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-ocean"
        >
          Today
        </Link>
        <span>Asia/Manila</span>
      </div>
      {!events.length && (
        <p className="mb-4 rounded-xl border border-dashed p-4 text-sm text-slate-500">
          No reservations or maintenance blocks in this period.
        </p>
      )}
      <ReservationCalendar
        view={view}
        days={days}
        selectedMonth={key.slice(0, 7)}
        events={events}
        now={loadedAt.getTime()}
        today={new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(loadedAt)}
      />
    </div>
  );
}
