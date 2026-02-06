"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getUsageToday,
  incrementUsageToday,
  isLimitReached,
  DAILY_LIMIT,
} from "./lib/usage";
import { addHistoryEntry, clearHistory, getHistory, type HistoryEntry } from "./lib/history";

type PortionSize = "small" | "medium" | "large";

interface EstimateResult {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: "low" | "medium" | "high";
  notes: string;
}

export default function Home() {
  const [meal, setMeal] = useState("");
  const [portion, setPortion] = useState<PortionSize>("medium");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageToday, setUsageToday] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  useEffect(() => {
    setUsageToday(getUsageToday());
    setHistory(getHistory());
    if (typeof window !== "undefined") {
      setIsPro(window.localStorage.getItem("quickcalories_isPro") === "true");
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
  }, []);

  const remaining = isPro
    ? Infinity
    : Math.max(0, DAILY_LIMIT - usageToday);
  const atLimit = isPro ? false : isLimitReached();

  async function handleEstimate(
    targetMealParam?: string,
    targetPortionParam?: PortionSize,
  ) {
    const targetMeal = (targetMealParam ?? meal).trim();
    const targetPortion = targetPortionParam ?? portion;
    if (!targetMeal || atLimit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // For MVP we send an anonymous device id and pro flag for basic
        // server-side rate limiting. In production this should use
        // signed tokens and backends like Redis/DB, not just headers.
        // x-device-id is anonymous and stored only in localStorage.
        // x-pro is a hint so the server can skip the free-tier limit.
        // Never trust these headers alone in a real system.
        ...(deviceId && {
          "x-device-id": deviceId,
        }),
        ...(isPro && { "x-pro": "true" }),
        body: JSON.stringify({
          meal: targetMeal,
          portion: targetPortion,
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
        portion: targetPortion,
        result: data.result,
        createdAt: new Date().toISOString(),
      };
      setHistory(addHistoryEntry(entry));
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleRerun(entry: HistoryEntry) {
    setMeal(entry.meal);
    setPortion(entry.portion);
    void handleEstimate(entry.meal, entry.portion);
  }

  function handleCopy(entry: HistoryEntry) {
    const text = `${entry.meal} — ${entry.result.calories} cal (P ${entry.result.protein_g}g / C ${entry.result.carbs_g}g / F ${entry.result.fat_g}g)`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        // ignore copy failures
      });
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex w-full items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              QuickCalories
            </h1>
            <Link
              href="/pricing"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Upgrade
            </Link>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Estimate calories from your meal description
          </p>
        </header>

        {upgraded && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            You’re now on QuickCalories Pro. Enjoy unlimited estimates.
          </div>
        )}

        <div className="flex flex-col gap-4">
          <label htmlFor="meal" className="sr-only">
            Describe your meal
          </label>
          <input
            id="meal"
            type="text"
            placeholder="e.g. Grilled chicken salad with olive oil"
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEstimate()}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            aria-label="Meal description"
          />
          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Portion size
            </span>
            <div className="flex gap-2" role="group" aria-label="Portion size">
              {(["small", "medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPortion(size)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 ${
                    portion === size
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-transparent text-zinc-700 hover:border-zinc-300 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="details"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Details (optional)
            </label>
            <textarea
              id="details"
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. extra cheese, butter, dressing on the side"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isPro
              ? "Unlimited estimates with Pro"
              : `${remaining} free estimate${
                  remaining !== 1 ? "s" : ""
                } left today`}
          </p>
          <button
            type="button"
            onClick={() => handleEstimate()}
            disabled={!meal.trim() || loading || atLimit}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
                className="mt-3 block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Unlock
              </Link>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {result !== null && !error && (
          <section
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-live="polite"
          >
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Estimated calories
            </h2>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              {result.calories}
              <span className="ml-1 text-lg font-normal text-zinc-500 dark:text-zinc-400">
                cal
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              P {result.protein_g}g · C {result.carbs_g}g · F {result.fat_g}g
              {result.notes ? ` · ${result.notes}` : ""}
            </p>
          </section>
        )}

        {history.length > 0 && (
          <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
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
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(entry)}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRerun(entry)}
                        className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
    </div>
  );
}
