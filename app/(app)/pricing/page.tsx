"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PricingPage() {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPro() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setIsPro(false);
        return;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .limit(1)
        .maybeSingle();
      setIsPro(!!data);
    }
    void loadPro();
  }, []);

  async function handleCheckout() {
    try {
      setError(null);
      setLoading(true);
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Unable to start checkout");
        setLoading(false);
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Unable to start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Pricing
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose the plan that fits you
        </p>
        {isPro && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              You’re Pro
            </p>
            <Link
              href="/account"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Manage subscription
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-4 sm:gap-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Free
          </h2>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            $0
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            5 estimates per day
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex items-center gap-2">
              <span className="text-zinc-400 dark:text-zinc-500">•</span>
              Calorie & macro estimates
            </li>
          </ul>
          <Link
            href="/"
            className="mt-5 block w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-center text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Get started
          </Link>
        </section>

        <section className="rounded-xl border-2 border-zinc-900 bg-zinc-900 p-5 shadow-sm dark:border-zinc-100 dark:bg-zinc-100 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Best value
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white dark:text-zinc-900">
            Pro
          </h2>
          <p className="mt-2 text-2xl font-semibold text-white dark:text-zinc-900">
            $4.99
            <span className="text-base font-normal text-zinc-300 dark:text-zinc-600">
              /month
            </span>
          </p>
          <p className="mt-1 text-sm text-zinc-300 dark:text-zinc-600">
            or $19/year (save 68%)
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-200 dark:text-zinc-700">
            <li className="flex items-center gap-2">
              <span className="text-zinc-400 dark:text-zinc-500">•</span>
              Unlimited estimates
            </li>
            <li className="flex items-center gap-2">
              <span className="text-zinc-400 dark:text-zinc-500">•</span>
              Estimate history
            </li>
            <li className="flex items-center gap-2">
              <span className="text-zinc-400 dark:text-zinc-500">•</span>
              Faster results
            </li>
          </ul>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isPro || loading}
            className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            {isPro ? "You're Pro" : loading ? "Redirecting…" : "Unlock"}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
