import { connection } from "next/server";
import Link from "next/link";
import { PageHeading } from "@/components/admin-ui";
import { ManualBookingForm } from "@/components/manual-booking-form";
import { getManualBookingOptions } from "@/services/manual-bookings";
export const instant = false;
export default async function NewBookingPage() {
  await connection();
  const options = await getManualBookingOptions();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeading
        eyebrow="Reservations"
        title="New admin booking"
        description="Create a reservation for a WhatsApp, phone or walk-in customer. Email and documents can be added later."
        actions={
          <Link href="/dashboard/bookings" className="admin-btn-secondary">
            Back to bookings
          </Link>
        }
      />
      <ManualBookingForm options={options} />
    </div>
  );
}
