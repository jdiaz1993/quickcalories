import { createBrowserClient } from "@supabase/ssr";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

  if (url === PLACEHOLDER_URL || anonKey === PLACEHOLDER_KEY) {
    if (typeof console !== "undefined") {
      console.warn(
        "[QuickCalories] Supabase is using placeholder URL/key. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local for history to work."
      );
    }
  }

  return createBrowserClient(url, anonKey);
}
