"use client";

import { useState } from "react";

type Props = {
  stripeCustomerId: string | null;
};

export function ManageSubscriptionButton({ stripeCustomerId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleOpenPortal() {
    if (!stripeCustomerId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: stripeCustomerId }),
      });
      const data = await res.json();
      if (res.ok && typeof data?.url === "string") {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  if (!stripeCustomerId) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Manage subscription from the billing portal when available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void handleOpenPortal()}
        disabled={loading}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
      >
        {loading ? "Opening…" : "Manage subscription"}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Cancel your subscription or update your payment method in the billing portal.
      </p>
    </div>
  );
}
