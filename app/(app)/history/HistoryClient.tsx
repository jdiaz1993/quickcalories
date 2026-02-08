"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Trash2,
  ChevronDown,
  History,
  Calendar,
} from "lucide-react";

export type EstimateRow = {
  id: string;
  meal: string;
  portion: string | null;
  details: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence?: string | null;
  notes?: string | null;
  created_at: string;
};

type DateFilter = "today" | "7" | "30" | "all";
type ViewMode = "day" | "all";

function getTodayString(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Local start/end of day for YYYY-MM-DD, as ISO for API */
function getDayRange(dateStr: string): { from: string; to: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function isCreatedOnLocalDate(iso: string, dateStr: string): boolean {
  const d = new Date(iso);
  const local = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  return local === dateStr;
}

const RING_SIZE = 60;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${date} • ${time}`;
}

function buildRerunUrl(row: EstimateRow): string {
  const params = new URLSearchParams();
  params.set("meal", row.meal);
  params.set("portion", row.portion ?? "medium");
  if (row.details) params.set("details", row.details);
  params.set("rerun", "1");
  return `/?${params.toString()}`;
}

function filterByDateRange(rows: EstimateRow[], range: DateFilter): EstimateRow[] {
  if (range === "all") return rows;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.filter((row) => {
    const d = new Date(row.created_at);
    if (range === "today") return d >= todayStart;
    if (range === "7") {
      const weekAgo = new Date(todayStart);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    if (range === "30") {
      const monthAgo = new Date(todayStart);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return d >= monthAgo;
    }
    return true;
  });
}

const LOCAL_STORAGE_KEY = "quickcal_local_estimates";

function loadLocalEstimateRows(): EstimateRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as { id: string; meal: string; result?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }; createdAt: string }[]) : [];
    return arr.map((e) => ({
      id: e.id,
      meal: e.meal,
      portion: "medium",
      details: null,
      calories: e.result?.calories ?? null,
      protein_g: e.result?.protein_g ?? null,
      carbs_g: e.result?.carbs_g ?? null,
      fat_g: e.result?.fat_g ?? null,
      confidence: null,
      notes: null,
      created_at: e.createdAt,
    }));
  } catch {
    return [];
  }
}

/* Mini macro ring for history cards: SVG-based, 56–64px, stroke ~6 */
function MacroRing({
  label,
  value,
  cap,
  ringClass,
  textClass,
}: {
  label: string;
  value: number;
  cap: number;
  ringClass: string;
  textClass: string;
}) {
  const pct = Math.min(100, cap > 0 ? (value / cap) * 100 : 0);
  const strokeDashoffset = RING_C * (1 - pct / 100);
  const displayValue = value ?? 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center">
        <svg
          className="-rotate-90"
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            strokeWidth={RING_STROKE}
            className="stroke-zinc-200 dark:stroke-zinc-700"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_R}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            className={ringClass}
            style={{
              strokeDasharray: RING_C,
              strokeDashoffset,
              transition: "stroke-dashoffset 0.4s ease-out",
            }}
          />
        </svg>
        <span
          className={`absolute text-sm font-bold tabular-nums ${textClass}`}
        >
          {displayValue}
        </span>
      </div>
      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence?: string | null }) {
  const c = (confidence ?? "medium").toLowerCase();
  const styles: Record<string, string> = {
    low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
    high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
  };
  const label = c === "low" ? "Low" : c === "high" ? "High" : "Medium";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${styles[c] ?? styles.medium}`}
    >
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-hidden
    >
      <div className="flex justify-between gap-2">
        <div className="h-5 flex-1 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-2 h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-4 flex justify-center gap-6">
        <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-14 w-14 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function HistoryCard({
  row,
  onDelete,
  deletingId,
}: {
  row: EstimateRow;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const hasNotes = row.notes && String(row.notes).trim() !== "";

  const protein = row.protein_g ?? 0;
  const carbs = row.carbs_g ?? 0;
  const fat = row.fat_g ?? 0;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* A) Top row: meal + calories + delete */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {row.meal}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {row.calories != null ? `${row.calories} kcal` : "—"}
          </span>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            disabled={deletingId === row.id}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* B) Sub row: timestamp */}
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {formatTimestamp(row.created_at)}
      </p>
      {/* C) Macro rings row */}
      <div className="mt-4 flex items-end justify-center gap-4 sm:gap-6">
        <MacroRing
          label="Protein"
          value={protein}
          cap={60}
          ringClass="stroke-emerald-500 dark:stroke-emerald-400"
          textClass="text-emerald-700 dark:text-emerald-300"
        />
        <MacroRing
          label="Carbs"
          value={carbs}
          cap={120}
          ringClass="stroke-amber-500 dark:stroke-amber-400"
          textClass="text-amber-700 dark:text-amber-300"
        />
        <MacroRing
          label="Fat"
          value={fat}
          cap={60}
          ringClass="stroke-rose-500 dark:stroke-rose-400"
          textClass="text-rose-700 dark:text-rose-300"
        />
      </div>
      {/* D) Confidence chip */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ConfidenceChip confidence={row.confidence} />
      </div>
      {/* E) Notes accordion */}
      {hasNotes && (
        <div className="mt-3 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            className="flex w-full items-center justify-between py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            <span>Why this estimate?</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${notesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {notesOpen && (
            <p className="pb-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {row.notes}
            </p>
          )}
        </div>
      )}
      {/* F) Re-run action */}
      <div className="mt-3">
        <Link
          href={buildRerunUrl(row)}
          className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
        >
          Re-run estimate
        </Link>
      </div>
    </article>
  );
}

export function HistoryClient({
  initialData,
  isLoggedIn,
}: {
  initialData: EstimateRow[];
  isLoggedIn: boolean;
}) {
  const [list, setList] = useState<EstimateRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  const [dayList, setDayList] = useState<EstimateRow[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  // Logged out: sync list from localStorage
  useEffect(() => {
    if (!isLoggedIn && typeof window !== "undefined") {
      setList(loadLocalEstimateRows());
    }
  }, [isLoggedIn]);

  // Logged in + day view: fetch that day's data
  useEffect(() => {
    if (!isLoggedIn || viewMode !== "day") {
      if (viewMode !== "day") setDayList([]);
      return;
    }
    const { from, to } = getDayRange(selectedDate);
    let cancelled = false;
    setDayLoading(true);
    fetch(`/api/estimates?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        if (!cancelled) setDayList(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDayList([]);
      })
      .finally(() => {
        if (!cancelled) setDayLoading(false);
      });
    return () => { cancelled = true; };
  }, [isLoggedIn, viewMode, selectedDate]);

  const dayViewList = useMemo(() => {
    if (viewMode !== "day") return [];
    if (isLoggedIn) return dayList;
    return list.filter((row) => isCreatedOnLocalDate(row.created_at, selectedDate));
  }, [viewMode, isLoggedIn, dayList, list, selectedDate]);

  const dayTotal = useMemo(() => dayViewList.reduce((sum, row) => sum + (row.calories ?? 0), 0), [dayViewList]);

  const filteredList = useMemo(() => {
    if (viewMode === "day") return [];
    let out = filterByDateRange(list, dateFilter);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((row) => row.meal.toLowerCase().includes(q));
    return out;
  }, [list, dateFilter, search, viewMode]);

  const displayList = viewMode === "day" ? dayViewList : filteredList;
  const displaySearch = viewMode === "all";

  async function fetchHistory() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/estimates", { credentials: "include" });
      if (res.status === 401) {
        setList([]);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? "Failed to load history");
        setList([]);
      } else {
        setList(json.data ?? []);
      }
    } catch {
      setLoadError("Request failed");
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteOne(id: string) {
    setDeletingId(id);
    try {
      if (isLoggedIn) {
        const res = await fetch(`/api/estimates?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          setList((prev) => prev.filter((r) => r.id !== id));
          setDayList((prev) => prev.filter((r) => r.id !== id));
        }
      } else {
        const next = list.filter((r) => r.id !== id);
        setList(next);
        setDayList((prev) => prev.filter((r) => r.id !== id));
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
          const arr = raw ? JSON.parse(raw) : [];
          const filtered = arr.filter((e: { id: string }) => e.id !== id);
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
        }
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAll() {
    if (!window.confirm("Clear all history? This cannot be undone.")) return;
    setClearing(true);
    try {
      if (isLoggedIn) {
        const res = await fetch("/api/estimates", { method: "DELETE", credentials: "include" });
        if (res.ok) {
          setList([]);
          setDayList([]);
        }
      } else {
        if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_STORAGE_KEY, "[]");
        setList([]);
        setDayList([]);
      }
    } finally {
      setClearing(false);
    }
  }

  const isLoading = loading || (viewMode === "day" && dayLoading);
  const showEmpty = !isLoading && displayList.length === 0;

  return (
    <div className="mx-auto max-w-md px-4 pb-24">
      {/* Header: title + view toggle + (all-view: filter + clear) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          History
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "day" ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"}`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "all" ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"}`}
            >
              All time
            </button>
          </div>
          {viewMode === "all" && (
            <>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                aria-label="Filter by date"
              >
                <option value="today">Today</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="all">All</option>
              </select>
              {(list.length > 0 || clearing) && (
                <button
                  type="button"
                  onClick={() => void clearAll()}
                  disabled={clearing}
                  className="rounded-xl border border-red-300 bg-transparent px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  {clearing ? "Clearing…" : "Clear history"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Day view: date picker + Today / Yesterday */}
      {viewMode === "day" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900 px-2 py-1">
            <Calendar className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-0 bg-transparent py-1.5 text-sm text-zinc-900 focus:ring-0 dark:text-zinc-50"
              aria-label="Select date"
            />
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayString())}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(getYesterdayString())}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Yesterday
          </button>
        </div>
      )}

      {/* Day view: total for selected day */}
      {viewMode === "day" && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Total · {new Date(selectedDate + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {dayTotal.toLocaleString()} kcal
          </p>
        </div>
      )}

      {/* All view: search */}
      {displaySearch && (
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
          <input
            type="search"
            placeholder="Search by meal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm text-zinc-900 placeholder-zinc-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-400"
            aria-label="Search history by meal"
          />
        </div>
      )}

      {!isLoggedIn && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Log in to sync history across devices
          </p>
          <Link href="/login?next=/history" className="mt-2 inline-block text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
            Log in →
          </Link>
        </div>
      )}

      {loadError && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400" role="alert">
          {loadError}
        </p>
      )}

      {isLoading && (
        <div className="mt-4 flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {showEmpty && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <History className="h-14 w-14 text-zinc-400 dark:text-zinc-500" />
          <p className="mt-4 text-center text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {viewMode === "day" ? "No meals that day" : "No history yet"}
          </p>
          <p className="mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {viewMode === "day" ? "Try another date or run an estimate." : "Run an estimate and it will show up here."}
          </p>
          <Link
            href="/"
            className="qc-button mt-4 inline-flex w-auto justify-center px-6"
          >
            Estimate a meal
          </Link>
        </div>
      )}

      {!isLoading && displayList.length > 0 && (
        <ul className="mt-4 flex flex-col gap-4" role="list">
          {displayList.map((row) => (
            <li key={row.id}>
              <HistoryCard
                row={row}
                onDelete={deleteOne}
                deletingId={deletingId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
