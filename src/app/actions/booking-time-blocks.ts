"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getFreshAdminSession } from "@/lib/auth";
import { AdminActionError } from "@/lib/admin-action-error";
import { businessTimestamp } from "@/lib/business-time";
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export async function addBookingTimeBlock(form: FormData) {
  const session = await getFreshAdminSession();
  if (!session) throw new AdminActionError("Administrator access required.");
  const parsed = z
    .object({
      startAt: localTime,
      endAt: localTime,
      scope: z.enum(["pickup", "return", "both"]),
      reason: z.string().trim().max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    throw new AdminActionError(
      "Enter the start, end and affected booking times.",
    );
  let start: string, end: string;
  try {
    start = businessTimestamp(parsed.data.startAt);
    end = businessTimestamp(parsed.data.endAt);
  } catch {
    throw new AdminActionError(
      "Enter valid dates and times in Philippine time.",
    );
  }
  if (Date.parse(end) <= Date.parse(start) || Date.parse(end) <= Date.now())
    throw new AdminActionError(
      "The block must end in the future, after its start.",
    );
  const { error } = await session.supabase.rpc("admin_add_booking_time_block", {
    p_start_at: start,
    p_end_at: end,
    p_scope: parsed.data.scope,
    p_reason: parsed.data.reason,
  });
  if (error)
    throw new AdminActionError(
      "Unable to block these times. Please refresh and try again.",
    );
  revalidatePath("/dashboard/settings");
}
export async function cancelBookingTimeBlock(form: FormData) {
  const session = await getFreshAdminSession();
  if (!session) throw new AdminActionError("Administrator access required.");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) throw new AdminActionError("Choose an existing time block.");
  const { error } = await session.supabase.rpc(
    "admin_cancel_booking_time_block",
    { p_id: id.data },
  );
  if (error)
    throw new AdminActionError(
      "Unable to remove this time block. Please refresh and try again.",
    );
  revalidatePath("/dashboard/settings");
}
export async function enable24HourBooking() {
  const session = await getFreshAdminSession();
  if (!session) throw new AdminActionError("Administrator access required.");
  const { error } = await session.supabase.rpc(
    "admin_enable_24_hour_booking",
    {},
  );
  if (error)
    throw new AdminActionError("Unable to enable 24/7 hours. Please retry.");
  revalidatePath("/dashboard/settings");
}
