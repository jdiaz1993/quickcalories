"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  stripeCustomerId: string | null;
};

export function AccountActions({ stripeCustomerId }: Props) {
  const router = useRouter();

  async function handleManage() {
    if (!stripeCustomerId) return;
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: stripeCustomerId }),
      });
      const data = await res.json();
      if (!res.ok || typeof data?.url !== "string") {
        return;
      }
      window.location.href = data.url;
    } catch {
      // ignore
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void handleManage()}
        disabled={!stripeCustomerId}
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
      >
        Manage subscription
      </button>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        Sign out
      </button>
    </div>
  );
}
