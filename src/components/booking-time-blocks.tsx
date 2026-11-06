import { requireAdmin } from "@/lib/auth";
import { readOperatingHours, weekdays } from "@/lib/booking-settings";
import {
  addBookingTimeBlock,
  cancelBookingTimeBlock,
  enable24HourBooking,
} from "@/app/actions/booking-time-blocks";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
const input =
  "mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm";
function timestamp(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
export async function BookingTimeBlocks({
  operatingHours,
}: {
  operatingHours: unknown;
}) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("booking_time_blocks")
    .select("*")
    .is("cancelled_at", null)
    .gt("end_at", new Date().toISOString())
    .order("start_at");
  const hours = readOperatingHours(operatingHours);
  const allDay =
    hours &&
    weekdays.every((day) => {
      const schedule = hours[day];
      return (
        schedule.enabled &&
        schedule.pickupOpen === "00:00" &&
        schedule.pickupClose === "00:00" &&
        schedule.returnOpen === "00:00" &&
        schedule.returnClose === "00:00"
      );
    });
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-extrabold text-deep-teal">
        Pickup & return availability
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Customers choose their exact times, including late-night and airport
        bookings. All times below are Philippine time (Asia/Manila).
      </p>
      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="font-bold">
          {allDay ? "Pickup & return open 24/7" : "Weekly hours are restricted"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Weekly hours are editable below. Resetting to 24/7 also opens delivery
          and collection hours; your time blocks remain in place.
        </p>
        <ActionForm
          action={enable24HourBooking}
          className="mt-3"
          successMessage="24/7 pickup, return, delivery and collection hours saved."
        >
          <SubmitButton>Set all hours to 24/7</SubmitButton>
        </ActionForm>
      </div>
      <h3 className="mt-6 font-extrabold">Block unavailable times</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Blocks prevent new pickups and/or returns during the selected period,
        including delivery and collection. The end time becomes available again.
        Existing bookings are unchanged; a rental may span a blocked period.
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          Unavailable times could not be loaded. Refresh before making changes.
        </p>
      ) : (
        <>
          <ActionForm
            action={addBookingTimeBlock}
            className="mt-4 grid gap-4 sm:grid-cols-2"
            successMessage="Unavailable times blocked."
          >
            <label className="text-sm font-bold">
              From
              <input
                required
                type="datetime-local"
                step={60}
                name="startAt"
                className={input}
              />
            </label>
            <label className="text-sm font-bold">
              Until
              <input
                required
                type="datetime-local"
                step={60}
                name="endAt"
                className={input}
              />
            </label>
            <label className="text-sm font-bold">
              Block
              <select name="scope" defaultValue="both" className={input}>
                <option value="both">Pickup and return</option>
                <option value="pickup">Pickup / delivery only</option>
                <option value="return">Return / collection only</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Internal note (optional)
              <input name="reason" maxLength={500} className={input} />
            </label>
            <div>
              <SubmitButton pendingLabel="Blocking times…">
                Block these times
              </SubmitButton>
            </div>
          </ActionForm>
          <h3 className="mt-6 font-bold">Upcoming blocks</h3>
          {!data?.length && (
            <p className="mt-2 text-sm text-slate-500">
              No unavailable times are blocked.
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {data?.map((block) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <p className="text-sm font-bold">
                    {timestamp(block.start_at)} → {timestamp(block.end_at)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {block.scope === "both"
                      ? "Pickup and return"
                      : block.scope === "pickup"
                        ? "Pickup / delivery"
                        : "Return / collection"}
                  </p>
                  {block.reason && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {block.reason}
                    </p>
                  )}
                </div>
                <ActionForm
                  action={cancelBookingTimeBlock}
                  successMessage="Time block removed."
                >
                  <input type="hidden" name="id" value={block.id} />
                  <SubmitButton pendingLabel="Removing…">
                    Remove block
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
