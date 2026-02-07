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
import { GlassCard } from "../components/GlassCard";
import { SegmentedControl } from "../components/SegmentedControl";
import { MacroRing } from "../components/MacroRing";
import { StickyActionBar } from "../components/StickyActionBar";

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
    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-2.5 text-xs text-emerald-800 backdrop-blur-sm dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
      You’re now on QuickCalories Pro. Enjoy unlimited estimates.
    </div>
  );
}

function ResultSkeleton() {
  return (
    <GlassCard className="p-6 opacity-90 transition-opacity duration-300" aria-hidden>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="h-12 w-28 animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-700/80" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-10 w-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </GlassCard>
  );
}

function EstimateButton({
  onClick,
  disabled,
  loading,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="qc-button"
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
  const [whyOpen, setWhyOpen] = useState(false);

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
    low: { label: "Low confidence", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
    medium: { label: "Medium confidence", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" },
    high: { label: "High confidence", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
  };

  return (
    <div className="qc-bg page-noise relative min-h-full min-h-[60vh] overflow-hidden rounded-none">
      <div className="relative z-10 grid grid-cols-1 items-start gap-8 transition-all duration-300 lg:grid-cols-[1fr_1fr]">
        {/* Left column: app card (meal input + portion + details + estimate) */}
        <div className="flex w-full flex-col gap-8 lg:gap-4">
          {/* Hero header */}
          <header className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <span className="text-3xl" aria-hidden>🍽️</span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              Let&apos;s check your meal
            </h1>
            <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
              Describe what you ate and we&apos;ll estimate calories and macros.
            </p>
          </header>

          <Suspense fallback={null}>
            <UpgradedBanner />
          </Suspense>

          {/* Input area — glass card: horizontal layout on desktop */}
          <GlassCard className="w-full p-5 transition-all duration-300 sm:p-6 lg:p-5 lg:rounded-3xl">
            <div className="space-y-5 lg:space-y-4">
              {/* Meal input: full width */}
              <div className="space-y-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                    <SearchIcon className="h-5 w-5" />
                  </span>
                  <input
                    id="meal"
                    type="text"
                    placeholder="e.g. Grilled chicken salad with olive oil"
                    value={meal}
                    onChange={(e) => setMeal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEstimate()}
                    className="w-full rounded-2xl border border-zinc-200/80 bg-white/80 py-3.5 pl-12 pr-4 text-base text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-[var(--qc-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--qc-accent)_20%,transparent)] dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-[var(--qc-accent)] dark:focus:ring-[color-mix(in_srgb,var(--qc-accent)_25%,transparent)]"
                    aria-label="Meal description"
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Be specific for better estimates.
                </p>
              </div>

              {/* Portion + details: side-by-side on desktop, equal heights */}
              <div className="space-y-5 lg:grid lg:grid-cols-2 lg:grid-rows-1 lg:items-stretch lg:gap-4 lg:space-y-0">
                <SegmentedControl
                  options={["small", "medium", "large"]}
                  value={portion}
                  onChange={(v) => setPortion(v as PortionSize)}
                  label="Portion size"
                />

                {/* Details accordion */}
                <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200/60 bg-zinc-50/50 dark:border-zinc-600/50 dark:bg-zinc-800/30 lg:min-h-[52px]">
                  <button
                    type="button"
                    onClick={() => setDetailsOpen((o) => !o)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100/80 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
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
                      <div className="border-t border-zinc-200/60 dark:border-zinc-600/50">
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
              </div>
            </div>
          </GlassCard>

          {/* Free estimates pill */}
          {!isPro && (
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400 lg:text-left">
              <span className="rounded-full bg-white/80 px-3 py-1 font-medium text-orange-700 shadow-sm dark:bg-zinc-800/80 dark:text-orange-300">
                {remaining ?? 0} free
              </span>{" "}
              estimate{remaining === 1 ? "" : "s"} left today
            </p>
          )}

          {/* Primary button — desktop: under card */}
          <div className="hidden sm:block">
            <EstimateButton
              onClick={() => handleEstimate()}
              disabled={!meal.trim() || loading || atLimit}
              loading={loading}
            />
          </div>

          {/* Limit reached */}
          {!isPro && atLimit && (
            <GlassCard className="w-full p-4">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Free limit reached. Unlock unlimited estimates.
              </p>
              <Link href="/pricing" className="qc-button mt-3 block text-center">
                Unlock
              </Link>
            </GlassCard>
          )}

          {error && (
            <p className="text-center text-sm text-red-600 dark:text-red-400 lg:text-left" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Right column: Results + History — full width, consistent gap */}
        <div className="flex w-full flex-col gap-6">
          {loading && (
            <div className="w-full animate-fade-slide-in">
              <ResultSkeleton />
            </div>
          )}

          {/* Result card */}
          {result !== null && !error && !loading && (
          <GlassCard
            className="w-full animate-fade-slide-in overflow-hidden p-6"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Yes. That looks like
            </p>
            <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {meal.trim()}
            </p>

            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                {result.calories}
              </p>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                kcal
              </span>
              <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${confidenceConfig[result.confidence].className}`}>
                {confidenceConfig[result.confidence].label}
              </span>
            </div>

            {/* Macro rings */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <MacroRing label="Protein" value={result.protein_g} tint="protein" max={150} />
              <MacroRing label="Carbs" value={result.carbs_g} tint="carbs" max={250} />
              <MacroRing label="Fat" value={result.fat_g} tint="fat" max={80} />
            </div>

            {/* Why this estimate? — collapsible */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-600/50">
              <button
                type="button"
                onClick={() => setWhyOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                <span>Why this estimate?</span>
                <svg
                  className={`h-4 w-4 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${whyOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: whyOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-700">
                    {result.notes ? (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{result.notes}</p>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        Estimate is based on typical portions and common ingredients.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveToHistory}
                disabled={savedToHistory}
                className="qc-button w-auto px-4 py-2.5 text-sm"
              >
                {savedToHistory ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCopyResult}
                className="rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Copy
              </button>
            </div>
          </GlassCard>
          )}

          {/* Placeholder when no result yet (desktop) — avoids empty right column */}
          {!loading && result === null && !error && (
            <GlassCard className="hidden w-full justify-center p-8 lg:flex lg:min-h-[320px] lg:flex-col" aria-hidden>
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Enter a meal above and tap Estimate to see calories and macros here.
              </p>
            </GlassCard>
          )}

          {/* History */}
          {history.length > 0 && (
          <GlassCard className="w-full p-5 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-zinc-600/50">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                History
              </h2>
              <button
                type="button"
                onClick={handleClearHistory}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
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
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/60 py-2.5 pl-3 pr-2 dark:border-zinc-600/50"
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
                        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRerun(entry)}
                        className="qc-button w-auto px-2.5 py-1.5 text-xs"
                      >
                        Re-run
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
          )}
        </div>

        {/* Spacer for sticky bar on mobile */}
        <div className="h-20 sm:hidden" aria-hidden />
      </div>

      {/* Sticky action bar — mobile only */}
      <StickyActionBar>
        <EstimateButton
          onClick={() => handleEstimate()}
          disabled={!meal.trim() || loading || atLimit}
          loading={loading}
        />
      </StickyActionBar>
    </div>
  );
}
