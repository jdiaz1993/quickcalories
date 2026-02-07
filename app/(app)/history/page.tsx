"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EstimateRow = {
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

const LIMIT = 20;

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [list, setList] = useState<EstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("estimates")
      .select("id, meal, portion, details, calories, protein_g, carbs_g, fat_g, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    setLoading(false);
    if (e) {
      setList([]);
      return;
    }
    setList(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function removeOne(id: string) {
    setDeletingId(id);
    const { error: e } = await supabase.from("estimates").delete().eq("id", id);
    setDeletingId(null);
    if (!e) setList((prev) => prev.filter((r) => r.id !== id));
  }

  async function clearAll() {
    setClearing(true);
    const { data: all } = await supabase
      .from("estimates")
      .select("id")
      .order("created_at", { ascending: false });
    const ids = (all ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const { error: e } = await supabase.from("estimates").delete().in("id", ids);
      if (!e) setList([]);
    } else {
      setList([]);
    }
    setClearing(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          History
        </h1>
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
      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading…
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No estimates yet. Sign in and run estimates to see them here.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {row.meal}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.calories ?? "—"} cal
                  {(row.protein_g != null || row.carbs_g != null || row.fat_g != null) && (
                    <> · P {row.protein_g ?? "—"} / C {row.carbs_g ?? "—"} / F {row.fat_g ?? "—"}g</>
                  )}
                  {" · "}
                  {formatTime(row.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeOne(row.id)}
                disabled={deletingId === row.id}
                className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Delete"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
