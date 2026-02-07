"use client";

import { useState } from "react";
import Link from "next/link";

export type EstimateRow = {
  id: string;
  meal: string;
  portion: string | null;
  details: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime()) return "Today";
  if (itemDate.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDate(rows: EstimateRow[]): { label: string; rows: EstimateRow[] }[] {
  const map = new Map<string, EstimateRow[]>();
  for (const row of rows) {
    const key = new Date(row.created_at).toLocaleDateString("en-CA");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const labels: { label: string; rows: EstimateRow[] }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = new Date(row.created_at).toLocaleDateString("en-CA");
    if (seen.has(key)) continue;
    seen.add(key);
    const groupLabel = getDateLabel(row.created_at);
    labels.push({ label: groupLabel, rows: map.get(key) ?? [] });
  }
  return labels;
}

function buildRerunUrl(row: EstimateRow): string {
  const params = new URLSearchParams();
  params.set("meal", row.meal);
  params.set("portion", row.portion ?? "medium");
  if (row.details) params.set("details", row.details);
  params.set("rerun", "1");
  return `/?${params.toString()}`;
}

export function HistoryClient({ initialData }: { initialData: EstimateRow[] }) {
  const [list, setList] = useState<EstimateRow[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function fetchHistory() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/estimates", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login?next=/history";
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

  async function clearAll() {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/estimates", { method: "DELETE", credentials: "include" });
      if (res.ok) setList([]);
    } finally {
      setClearing(false);
    }
  }

  const grouped = groupByDate(list);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          History
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchHistory()}
            disabled={loading}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Refresh
          </button>
          {(list.length > 0 || clearing) && (
            <button
              type="button"
              onClick={() => void clearAll()}
              disabled={clearing}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {clearing ? "Clearing…" : "Clear history"}
            </button>
          )}
        </div>
      </div>
      {loadError && (
        <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
          Couldn&apos;t load history: {loadError}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading…
        </p>
      ) : list.length === 0 && !loadError ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            No estimates yet
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Run an estimate on the <Link href="/" className="underline underline-offset-2">home page</Link> while signed in—it saves automatically.
          </p>
        </div>
      ) : list.length > 0 ? (
        <div className="space-y-6">
          {grouped.map(({ label, rows }) => (
            <section key={label}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                {label}
              </h2>
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {row.meal}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {row.calories ?? "—"} kcal
                        {(row.protein_g != null || row.carbs_g != null || row.fat_g != null) && (
                          <> · P {row.protein_g ?? "—"} / C {row.carbs_g ?? "—"} / F {row.fat_g ?? "—"}g</>
                        )}
                        {" · "}
                        {formatTime(row.created_at)}
                      </p>
                    </div>
                    <Link
                      href={buildRerunUrl(row)}
                      className="qc-button shrink-0 px-2.5 py-1.5 text-xs"
                    >
                      Re-run
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
