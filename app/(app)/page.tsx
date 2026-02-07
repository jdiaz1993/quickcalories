"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getUsageToday,
  incrementUsageToday,
  isLimitReached,
  DAILY_LIMIT,
} from "../lib/usage";
import { addHistoryEntry, clearHistory, getHistory, type HistoryEntry } from "../lib/history";

type PortionSize = "small" | "medium" | "large";

interface EstimateResult {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "low" | "medium" | "high";
  notes: string;
}

function MealIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function UpgradedBanner() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const upgraded = params.get("upgraded") === "1";
  if (!upgraded) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
      You’re now on QuickCalories Pro. Enjoy unlimited estimates.
    </div>
  );
}

function ResultSkeleton() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-baseline gap-2">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-5 w-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="mt-4 flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 w-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </section>
  );
}

export default function Home() {
  const [meal, setMeal] = useState("");
  const [portion, setPortion] = useState<PortionSize>("medium");
  const [details, setDetails] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageToday, setUsageToday] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    setUsageToday(getUsageToday());
    setHistory(getHistory());
    if (typeof window !== "undefined") {
      const existing = window.localStorage.getItem("quickcalories_device_id");
      if (existing) {
        setDeviceId(existing);
      } else {
        const newId = crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem("quickcalories_device_id", newId);
        setDeviceId(newId);
      }
    }
    async function loadAuth() {
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
    void loadAuth();
  }, []);

  const remaining = isPro ? null : Math.max(0, DAILY_LIMIT - usageToday);
  const atLimit = isPro ? false : isLimitReached();

  async function handleEstimate(targetMealParam?: string) {
    const targetMeal = (targetMealParam ?? meal).trim();
    if (!targetMeal || atLimit) return;
    setError(null);
    setResult(null);
    setSavedToHistory(false);
    setLoading(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...(deviceId && { "x-device-id": deviceId }),
        body: JSON.stringify({
          meal: targetMeal,
          portion,
          details: details.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setResult(data.result);
      if (!isPro) {
        setUsageToday(incrementUsageToday());
      }
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        meal: targetMeal,
        result: data.result,
        createdAt: new Date().toISOString(),
      };
      setHistory(addHistoryEntry(entry));
      setSavedToHistory(true);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveToHistory() {
    if (!result || !meal.trim()) return;
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      meal: meal.trim(),
      result,
      createdAt: new Date().toISOString(),
    };
    setHistory(addHistoryEntry(entry));
    setSavedToHistory(true);
  }

  function handleCopyResult() {
    if (!result || !meal.trim()) return;
    const text = `${meal.trim()} — ${result.calories} cal (P ${result.protein_g}g / C ${result.carbs_g}g / F ${result.fat_g}g)`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function handleRerun(entry: HistoryEntry) {
    setMeal(entry.meal);
    setResult(null);
    setSavedToHistory(false);
    void handleEstimate(entry.meal);
  }

  function handleCopy(entry: HistoryEntry) {
    const text = `${entry.meal} — ${entry.result.calories} cal (P ${entry.result.protein_g}g / C ${entry.result.carbs_g}g / F ${entry.result.fat_g}g)`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  const confidenceConfig = {
    low: { label: "Low confidence", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
    medium: { label: "Medium confidence", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
    high: { label: "High confidence", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex w-full items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Estimate
          </h1>
          {isPro && (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
              Pro
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Get calories and macros from any meal description
        </p>
      </header>

      <Suspense fallback={null}>
        <UpgradedBanner />
      </Suspense>

      {/* Meal input with icon + helper */}
      <div className="space-y-1.5">
        <label htmlFor="meal" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          What did you eat?
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
            <MealIcon className="h-5 w-5" />
          </span>
          <input
            id="meal"
            type="text"
            placeholder="e.g. Grilled chicken salad with olive oil"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEstimate()}
            className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-base text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            aria-label="Meal description"
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Be specific for better estimates (e.g. cooking method, sauces)
        </p>
      </div>

      {/* Portion segmented buttons */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Portion size
        </span>
        <div className="inline-flex w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
          {(["small", "medium", "large"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPortion(size)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                portion === size
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible details accordion */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex w-full items-center justify-between bg-zinc-50/50 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span>Add details</span>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform dark:text-zinc-400 ${detailsOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {detailsOpen && (
          <div className="border-t border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              id="details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. extra cheese, butter, dressing on the side"
              className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-50 dark:placeholder-zinc-500"
            />
          </div>
        )}
      </div>

      {!isPro && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {remaining ?? 0} free estimate{remaining === 1 ? "" : "s"} left today
        </p>
      )}

      <button
        type="button"
        onClick={() => handleEstimate()}
        disabled={!meal.trim() || loading || atLimit}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? "Estimating…" : "Estimate"}
      </button>

      {!isPro && atLimit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Free limit reached. Unlock unlimited estimates.
          </p>
          <Link
            href="/pricing"
            className="mt-3 block w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Unlock
          </Link>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {loading && <ResultSkeleton />}

      {result !== null && !error && !loading && (
        <section
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                {result.calories}
              </p>
              <p className="mt-0.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                calories
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${confidenceConfig[result.confidence].className}`}>
              {confidenceConfig[result.confidence].label}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Protein {result.protein_g}g
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Carbs {result.carbs_g}g
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Fat {result.fat_g}g
            </span>
          </div>

          {result.notes && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              {result.notes}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={handleSaveToHistory}
              disabled={savedToHistory}
              className="flex-1 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              {savedToHistory ? "Saved to History" : "Save to History"}
            </button>
            <button
              type="button"
              onClick={handleCopyResult}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Copy
            </button>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              History
            </h2>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Clear
            </button>
          </div>
          <ul className="space-y-3 text-sm">
            {history.map((entry) => {
              const time = new Date(entry.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-zinc-900 dark:text-zinc-50">
                      {entry.meal}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {entry.result.calories} cal · {time}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(entry)}
                      className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRerun(entry)}
                      className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Re-run
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
