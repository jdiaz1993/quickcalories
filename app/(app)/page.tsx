"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getUsageToday,
  incrementUsageToday,
  isLimitReached,
  DAILY_LIMIT,
} from "../lib/usage";
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

interface HistoryEntry {
  id: string;
  meal: string;
  portion: string;
  details: string | null;
  result: EstimateResult;
  createdAt: string;
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

function HomeInner() {
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const searchParams = useSearchParams();
  const rerunExecuted = useRef(false);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [dailyProteinGoal, setDailyProteinGoal] = useState(150);
  const [dailyCarbsGoal, setDailyCarbsGoal] = useState(200);
  const [dailyFatGoal, setDailyFatGoal] = useState(70);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalProteinInput, setGoalProteinInput] = useState("");
  const [goalCarbsInput, setGoalCarbsInput] = useState("");
  const [goalFatInput, setGoalFatInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");

  useEffect(() => {
    setUsageToday(getUsageToday());
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
      const draft = sessionStorage.getItem("quickcal_draft");
      if (draft && !searchParams.get("rerun")) {
        try {
          const { meal: m, portion: p, details: d } = JSON.parse(draft) as { meal?: string; portion?: string; details?: string };
          if (m) setMeal(m);
          if (p && ["small", "medium", "large"].includes(p)) setPortion(p as PortionSize);
          if (d) setDetails(d);
        } catch {
          /* ignore */
        }
      }
    }
    async function loadAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user?.id);
      if (!user?.id) {
        setIsPro(false);
        setHistory([]);
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem("quickcalories_daily_goal");
          setDailyGoal(stored ? Math.max(1, parseInt(stored, 10) || 2000) : 2000);
          const p = window.localStorage.getItem("quickcalories_daily_protein_goal");
          setDailyProteinGoal(p ? Math.max(0, parseInt(p, 10) || 150) : 150);
          const c = window.localStorage.getItem("quickcalories_daily_carbs_goal");
          setDailyCarbsGoal(c ? Math.max(0, parseInt(c, 10) || 200) : 200);
          const f = window.localStorage.getItem("quickcalories_daily_fat_goal");
          setDailyFatGoal(f ? Math.max(0, parseInt(f, 10) || 70) : 70);
        }
        return;
      }
      const [subsRes, profileRes] = await Promise.all([
        supabase.from("subscriptions").select("id").eq("user_id", user.id).in("status", ["active", "trialing"]).limit(1).maybeSingle(),
        supabase.from("profiles").select("daily_goal, daily_protein_goal, daily_carbs_goal, daily_fat_goal").eq("user_id", user.id).maybeSingle(),
      ]);
      setIsPro(!!subsRes.data);
      const p = profileRes.data;
      setDailyGoal(p?.daily_goal != null && p.daily_goal > 0 ? p.daily_goal : 2000);
      setDailyProteinGoal(p?.daily_protein_goal != null && p.daily_protein_goal >= 0 ? p.daily_protein_goal : 150);
      setDailyCarbsGoal(p?.daily_carbs_goal != null && p.daily_carbs_goal >= 0 ? p.daily_carbs_goal : 200);
      setDailyFatGoal(p?.daily_fat_goal != null && p.daily_fat_goal >= 0 ? p.daily_fat_goal : 70);
    }
    void loadAuth();
  }, []);

  function isTodayLocal(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }

  async function loadToday() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, meal, portion, details, calories, protein_g, carbs_g, fat_g, confidence, notes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        setHistory([]);
        return;
      }
      const all = data ?? [];
      const todayRows = all.filter((r) => isTodayLocal(r.created_at));
      setHistory(
        todayRows.map((r) => ({
          id: r.id,
          meal: r.meal,
          portion: r.portion ?? "medium",
          details: r.details,
          result: {
            calories: r.calories,
            protein_g: r.protein_g,
            carbs_g: r.carbs_g,
            fat_g: r.fat_g,
            confidence: r.confidence as "low" | "medium" | "high",
            notes: r.notes ?? "",
          },
          createdAt: r.created_at,
        }))
      );
      return;
    }
    if (typeof window === "undefined") {
      setHistory([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem("quickcal_local_estimates");
      const arr = raw ? (JSON.parse(raw) as { id: string; meal: string; result: { calories: number }; createdAt: string }[]) : [];
      const todayEntries = arr.filter((e) => isTodayLocal(e.createdAt));
      setHistory(
        todayEntries.map((e) => ({
          id: e.id,
          meal: e.meal,
          portion: "medium" as const,
          details: null as string | null,
          result: {
            calories: e.result.calories,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            confidence: "medium" as const,
            notes: "",
          },
          createdAt: e.createdAt,
        }))
      );
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    void loadToday();
  }, [isLoggedIn]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && (meal || portion !== "medium" || details)) {
        sessionStorage.setItem("quickcal_draft", JSON.stringify({ meal, portion, details }));
      }
    };
  }, [meal, portion, details]);

  useEffect(() => {
    const mealParam = searchParams.get("meal");
    const rerun = searchParams.get("rerun") === "1";
    if (mealParam && rerun && !rerunExecuted.current) {
      rerunExecuted.current = true;
      const portionParam = (searchParams.get("portion") as PortionSize) ?? "medium";
      const detailsParam = searchParams.get("details") ?? "";
      setMeal(mealParam);
      setPortion(portionParam);
      setDetails(detailsParam);
      setResult(null);
      setSavedToHistory(false);
      void handleEstimate(mealParam, portionParam, detailsParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!goalEditOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelGoalEdit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goalEditOpen]);

  const remaining = isPro ? null : Math.max(0, DAILY_LIMIT - usageToday);
  const atLimit = isPro ? false : isLimitReached();
  const todayTotal = history.reduce((sum, e) => sum + (e.result?.calories ?? 0), 0);
  const todayProtein = history.reduce((sum, e) => sum + (e.result?.protein_g ?? 0), 0);
  const todayCarbs = history.reduce((sum, e) => sum + (e.result?.carbs_g ?? 0), 0);
  const todayFat = history.reduce((sum, e) => sum + (e.result?.fat_g ?? 0), 0);

  async function handleEstimate(targetMealParam?: string, overridePortion?: string, overrideDetails?: string) {
    const targetMeal = (targetMealParam ?? meal).trim();
    if (!targetMeal || atLimit) return;
    const usePortion = (overridePortion ?? portion) as PortionSize;
    const useDetails = overrideDetails ?? details;
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
          portion: usePortion,
          details: (useDetails ?? "").trim() || undefined,
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
      if (isLoggedIn) {
        void saveEstimateToSupabase(targetMeal, usePortion, (useDetails ?? "").trim(), data.result);
      } else if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("quickcal_local_estimates");
          const arr = raw ? JSON.parse(raw) : [];
          arr.push({
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            meal: targetMeal,
            result: { calories: data.result.calories },
            createdAt: new Date().toISOString(),
          });
          window.localStorage.setItem("quickcal_local_estimates", JSON.stringify(arr));
          void loadToday();
        } catch {
          /* ignore */
        }
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveEstimateToSupabase(
    mealVal: string,
    portionVal: string,
    detailsVal: string,
    resultVal: EstimateResult,
  ) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    setSaveError(null);
    const { error } = await supabase.from("estimates").insert({
      user_id: user.id,
      meal: mealVal.trim(),
      portion: portionVal,
      details: detailsVal || null,
      calories: resultVal.calories,
      protein_g: resultVal.protein_g,
      carbs_g: resultVal.carbs_g,
      fat_g: resultVal.fat_g,
      confidence: resultVal.confidence,
      notes: resultVal.notes ?? "",
    });
    if (error) {
      setSaveError(`Couldn't save to history: ${error.message}`);
      return;
    }
    await loadToday();
    setSavedToHistory(true);
  }

  async function handleSaveToHistory() {
    if (!result || !meal.trim()) return;
    setSaveError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setSaveError("Log in to save history");
      router.push("/login?next=/");
      return;
    }
    const { error } = await supabase.from("estimates").insert({
      user_id: user.id,
      meal: meal.trim(),
      portion,
      details: details.trim() || null,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      confidence: result.confidence,
      notes: result.notes ?? "",
    });
    if (error) {
      setSaveError(error.message);
      return;
    }
    await loadToday();
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
    setPortion((entry.portion ?? "medium") as PortionSize);
    setDetails(entry.details ?? "");
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

  async function handleClearHistory() {
    if (!isLoggedIn) return;
    if (!confirm("Clear all history?")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase.from("estimates").delete().eq("user_id", user.id);
    setHistory([]);
  }

  const GOAL_CAL_MIN = 500;
  const GOAL_CAL_MAX = 8000;
  const GOAL_PROTEIN_MAX = 500;
  const GOAL_CARBS_MAX = 600;
  const GOAL_FAT_MAX = 300;

  function openGoalEdit() {
    setGoalInput(String(dailyGoal));
    setGoalProteinInput(String(dailyProteinGoal));
    setGoalCarbsInput(String(dailyCarbsGoal));
    setGoalFatInput(String(dailyFatGoal));
    setGoalError("");
    setGoalEditOpen(true);
  }

  function parseGoal(raw: string, min: number, max: number, name: string): number | null {
    const s = raw.trim();
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return Math.round(n);
  }

  async function saveGoal() {
    const cal = parseGoal(goalInput, GOAL_CAL_MIN, GOAL_CAL_MAX, "Calories");
    if (cal === null) {
      setGoalError("Calories: enter a number between " + GOAL_CAL_MIN + " and " + GOAL_CAL_MAX);
      return;
    }
    const protein = parseGoal(goalProteinInput, 0, GOAL_PROTEIN_MAX, "Protein");
    if (protein === null) {
      setGoalError("Protein: enter 0–" + GOAL_PROTEIN_MAX + " g");
      return;
    }
    const carbs = parseGoal(goalCarbsInput, 0, GOAL_CARBS_MAX, "Carbs");
    if (carbs === null) {
      setGoalError("Carbs: enter 0–" + GOAL_CARBS_MAX + " g");
      return;
    }
    const fat = parseGoal(goalFatInput, 0, GOAL_FAT_MAX, "Fat");
    if (fat === null) {
      setGoalError("Fat: enter 0–" + GOAL_FAT_MAX + " g");
      return;
    }
    setGoalError("");
    setGoalSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { error } = await supabase.from("profiles").upsert(
        { user_id: user.id, daily_goal: cal, daily_protein_goal: protein, daily_carbs_goal: carbs, daily_fat_goal: fat },
        { onConflict: "user_id" }
      );
      if (error) {
        setGoalError(error.message || "Failed to save. Try again.");
        setGoalSaving(false);
        return;
      }
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem("quickcalories_daily_goal", String(cal));
      window.localStorage.setItem("quickcalories_daily_protein_goal", String(protein));
      window.localStorage.setItem("quickcalories_daily_carbs_goal", String(carbs));
      window.localStorage.setItem("quickcalories_daily_fat_goal", String(fat));
    }
    setDailyGoal(cal);
    setDailyProteinGoal(protein);
    setDailyCarbsGoal(carbs);
    setDailyFatGoal(fat);
    setGoalEditOpen(false);
    setGoalSaving(false);
  }

  function cancelGoalEdit() {
    if (goalSaving) return;
    setGoalError("");
    setGoalEditOpen(false);
  }

  const confidenceConfig = {
    low: { label: "Low confidence", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
    medium: { label: "Medium confidence", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" },
    high: { label: "High confidence", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="grid w-full grid-cols-1 items-stretch gap-8 transition-all duration-300 lg:grid-cols-2">
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

          {/* Input area */}
          <GlassCard className="w-full p-5 sm:p-6 lg:p-5">
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
                    className="w-full rounded-2xl border border-zinc-200 bg-white py-3.5 pl-12 pr-4 text-base text-zinc-900 placeholder-zinc-500 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-400 dark:focus:border-orange-500 dark:focus:ring-orange-500/30"
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
                <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 lg:min-h-[52px]">
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
                      <div className="border-t border-zinc-200 dark:border-zinc-700">
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
              <span className="rounded-full bg-white px-3 py-1 font-medium text-orange-700 shadow-sm dark:bg-zinc-800 dark:text-orange-300">
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
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
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
                  <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                    {result.notes ? (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">{result.notes}</p>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                {savedToHistory ? "Saved" : isLoggedIn ? "Save to history" : "Log in to save history"}
              </button>
              <button
                type="button"
                onClick={handleCopyResult}
                className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
              >
                Copy
              </button>
            </div>
            {saveError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {saveError}
              </p>
            )}
          </GlassCard>
          )}

          {/* Placeholder when no result yet (desktop) — avoids empty right column */}
          {!loading && result === null && !error && (
            <GlassCard className="hidden w-full min-h-[260px] flex-col justify-center p-8 lg:flex lg:min-h-[320px]" aria-hidden>
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                Enter a meal above and tap Estimate to see calories and macros here.
              </p>
            </GlassCard>
          )}

          {/* Daily goal */}
          <GlassCard className="w-full p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Daily goal
              </h2>
              <button
                type="button"
                onClick={openGoalEdit}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
              >
                Edit goal
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{todayTotal.toLocaleString()}</span>
              <span className="text-zinc-500 dark:text-zinc-400">/</span>
              <span className="text-xl font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{dailyGoal.toLocaleString()} kcal</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 dark:bg-emerald-500/90 transition-all duration-300"
                style={{ width: `${dailyGoal > 0 ? Math.min(100, (todayTotal / dailyGoal) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{todayProtein}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">/</span>
                  <span className="text-xl font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{dailyProteinGoal} g protein</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 dark:bg-emerald-500/90 transition-all duration-300"
                    style={{ width: `${dailyProteinGoal > 0 ? Math.min(100, (todayProtein / dailyProteinGoal) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{todayCarbs}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">/</span>
                  <span className="text-xl font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{dailyCarbsGoal} g carbs</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 dark:bg-amber-500/90 transition-all duration-300"
                    style={{ width: `${dailyCarbsGoal > 0 ? Math.min(100, (todayCarbs / dailyCarbsGoal) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{todayFat}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">/</span>
                  <span className="text-xl font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">{dailyFatGoal} g fat</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 dark:bg-rose-500/90 transition-all duration-300"
                    style={{ width: `${dailyFatGoal > 0 ? Math.min(100, (todayFat / dailyFatGoal) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Today */}
          <GlassCard className="w-full p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Today
            </h2>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                No meals saved today yet.
              </p>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {todayTotal.toLocaleString()} kcal
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  total today
                </p>
                <ul className="mt-4 space-y-2">
                  {history.map((entry) => {
                    const time = new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 py-2.5 pl-3 pr-3 dark:border-zinc-700"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {entry.meal}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {time}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {entry.result.calories} kcal
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href="/history"
                  className="mt-3 inline-block text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                >
                  View full history →
                </Link>
              </>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Edit goal modal */}
      {goalEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) cancelGoalEdit(); }}
        >
          <GlassCard className="w-full max-w-sm p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Edit daily goals</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Calories (kcal) and macros (g).</p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="goal-cal" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Calories (kcal)</label>
                <input
                  id="goal-cal"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={10}
                  value={goalInput}
                  onChange={(e) => { setGoalInput(e.target.value); if (goalError) setGoalError(""); }}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="2000"
                />
              </div>
              <div>
                <label htmlFor="goal-protein" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Protein (g)</label>
                <input
                  id="goal-protein"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={goalProteinInput}
                  onChange={(e) => { setGoalProteinInput(e.target.value); if (goalError) setGoalError(""); }}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="150"
                />
              </div>
              <div>
                <label htmlFor="goal-carbs" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Carbs (g)</label>
                <input
                  id="goal-carbs"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={goalCarbsInput}
                  onChange={(e) => { setGoalCarbsInput(e.target.value); if (goalError) setGoalError(""); }}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="200"
                />
              </div>
              <div>
                <label htmlFor="goal-fat" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fat (g)</label>
                <input
                  id="goal-fat"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={goalFatInput}
                  onChange={(e) => { setGoalFatInput(e.target.value); if (goalError) setGoalError(""); }}
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="70"
                />
              </div>
            </div>
            {goalError && (
              <p id="goal-error" className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {goalError}
              </p>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelGoalEdit}
                disabled={goalSaving}
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveGoal()}
                disabled={goalSaving}
                className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {goalSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
