"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const LIMIT = 50;

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

export default function HistoryPage() {
  const [list, setList] = useState<EstimateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        router.replace("/login?next=/history");
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("estimates")
        .select("id, meal, portion, details, calories, protein_g, carbs_g, fat_g, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      setLoading(false);
      if (error) {
        setList([]);
        return;
      }
      setList(data ?? []);
    }
    void init();
  }, [router]);

  async function clearAll() {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    setClearing(true);
    await supabase.from("estimates").delete().eq("user_id", user.id);
    setList([]);
    setClearing(false);
  }

  const grouped = groupByDate(list);

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
          No estimates yet. Save estimates from the home page to see them here.
        </p>
      ) : (
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
      )}
    </div>
  );
}
