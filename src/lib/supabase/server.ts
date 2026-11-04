import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";
export async function createClient() {
  const cookieStore = await cookies();
  const { url, apiKey } = getSupabasePublicConfig();
  return createServerClient<Database>(url, apiKey, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
            : AbortSignal.timeout(10000),
        }),
    },
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
