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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" aria-hidden>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="h-12 w-32 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="mt-5 flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 flex-1 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="mt-5 h-2 w-full animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-6 flex gap-2">
        <div className="h-9 flex-1 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-9 w-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
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
    low: { label: "Low", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
    medium: { label: "Medium", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" },
    high: { label: "High", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
  };

  function MacroIconProtein({ className }: { className?: string }) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  function MacroIconCarbs({ className }: { className?: string }) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  function MacroIconFat({ className }: { className?: string }) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" strokeWidth={2} />
      </svg>
    );
  }

  const portionSizes = ["small", "medium", "large"] as const;
  const portionIndex = portionSizes.indexOf(portion);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Let&apos;s check your meal together
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Describe what you ate and we&apos;ll estimate calories and macros
        </p>
      </header>

      <Suspense fallback={null}>
        <UpgradedBanner />
      </Suspense>

      {/* Meal input — larger, shadow, icon */}
      <div className="space-y-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
            <SearchIcon className="h-5 w-5" />
          </span>
          <input
            id="meal"
            type="text"
            placeholder="Search or describe your meal..."
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEstimate()}
            className="w-full rounded-2xl border border-zinc-200 bg-white py-4 pl-12 pr-5 text-base text-zinc-900 shadow-sm placeholder-zinc-400 outline-none transition-all focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder-zinc-500 dark:focus:border-emerald-600 dark:focus:ring-emerald-500/20"
            aria-label="Meal description"
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Be specific for better estimates (e.g. grilled chicken salad with olive oil)
        </p>
      </div>

      {/* Portion — segmented control with animated active pill */}
      <div className="space-y-2.5">
        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Portion size
        </span>
        <div className="relative flex w-full rounded-2xl border border-zinc-200 bg-zinc-100/80 p-1.5 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-xl bg-white shadow-sm transition-all duration-200 ease-out dark:bg-zinc-700"
            style={{
              left: `calc(${portionIndex * (100 / 3)}% + 6px)`,
              width: `calc(${100 / 3}% - 12px)`,
            }}
          />
          {portionSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPortion(size)}
              className={`relative z-10 flex-1 rounded-xl px-3 py-3 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                portion === size
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Details accordion — smooth expand/collapse */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        >
          <span>Add details</span>
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${detailsOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: detailsOpen ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="border-t border-zinc-100 dark:border-zinc-700">
              <textarea
                id="details"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. extra cheese, butter, dressing on the side"
                className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-50 dark:placeholder-zinc-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Free estimates — pill callout */}
      {!isPro && (
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/40">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-400">
              {remaining ?? 0} free
            </span>{" "}
            estimate{remaining === 1 ? "" : "s"} left today
          </p>
        </div>
      )}

      {/* Primary button — gradient, loading spinner */}
      <button
        type="button"
        onClick={() => handleEstimate()}
        disabled={!meal.trim() || loading || atLimit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/30 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:shadow-emerald-600/20 dark:hover:shadow-emerald-600/25"
      >
        {loading ? (
          <>
            <svg
              className="h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Estimating…</span>
          </>
        ) : (
          "Estimate"
        )}
      </button>

      {!isPro && atLimit && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Free limit reached. Unlock unlimited estimates.
          </p>
          <Link
            href="/pricing"
            className="mt-3 block w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md hover:from-emerald-600 hover:to-emerald-700 dark:shadow-emerald-600/20"
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
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          aria-live="polite"
        >
          {/* Meal name */}
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {meal.trim()}
          </p>

          {/* Hero calories + unit pill */}
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              {result.calories}
            </p>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-semibold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              kcal
            </span>
            <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${confidenceConfig[result.confidence].className}`}>
              {confidenceConfig[result.confidence].label}
            </span>
          </div>

          {/* Macro chips with icons + colored progress bars */}
          <div className="mt-6 space-y-3">
            {[
              { label: "Protein", value: result.protein_g, max: 150, Icon: MacroIconProtein, bar: "bg-emerald-400 dark:bg-emerald-500" },
              { label: "Carbs", value: result.carbs_g, max: 250, Icon: MacroIconCarbs, bar: "bg-emerald-500 dark:bg-emerald-400" },
              { label: "Fat", value: result.fat_g, max: 80, Icon: MacroIconFat, bar: "bg-emerald-600 dark:bg-emerald-300" },
            ].map(({ label, value, max, Icon, bar }) => {
              const pct = Math.min(100, (value / max) * 100);
              return (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-200">
                      <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      {label}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{value}g</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {result.notes && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              {result.notes}
            </p>
          )}

          {/* Divider */}
          <div className="my-5 border-t border-zinc-100 dark:border-zinc-700" />

          {/* Save + Copy inline (small secondary) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToHistory}
              disabled={savedToHistory}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {savedToHistory ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCopyResult}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Update details
            </button>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              History
            </h2>
            <button
              type="button"
              onClick={handleClearHistory}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
                  className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 py-2.5 pl-3 pr-2 dark:border-zinc-700/80"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {entry.meal}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {entry.result.calories} kcal · {time}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(entry)}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRerun(entry)}
                      className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
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
