const HISTORY_KEY = "quickcalories_history";
const HISTORY_LIMIT = 20;

export interface HistoryEntry {
  id: string;
  meal: string;
  result: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    confidence: "low" | "medium" | "high";
    notes: string;
  };
  createdAt: string; // ISO string
}

function safeParse(raw: string | null): HistoryEntry[] {
  if (!raw || typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_KEY);
  return safeParse(raw);
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const existing = getHistory();
  const next = [entry, ...existing].slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode errors
  }
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

