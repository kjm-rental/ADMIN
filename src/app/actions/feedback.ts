"use server";
import { AdminActionError } from "@/lib/admin-action-error";
import { unstable_rethrow } from "next/navigation";
export async function submitAdminAction(
  action: (data: FormData) => Promise<void>,
  _previous: { error: string; saved: boolean },
  data: FormData,
) {
  try {
    await action(data);
    return { error: "", saved: true };
  } catch (error) {
    // Preserve authentication redirects and other Next control-flow exceptions.
    unstable_rethrow(error);
    return {
      error:
        error instanceof AdminActionError
          ? error.message
          : "The action could not be completed. Review the current record before retrying; a partial change may have been saved.",
      saved: false,
    };
  }
}
