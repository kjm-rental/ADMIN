import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
export async function createClient() {
  const cookieStore = await cookies();
  const { url, apiKey } = getSupabasePublicConfig();
  return createServerClient<Database>(url, apiKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Future auth proxy will refresh sessions. */
        }
      },
    },
  });
}
