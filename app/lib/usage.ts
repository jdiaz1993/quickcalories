const STORAGE_KEY = "quickcalories_daily_usage";
const DAILY_LIMIT = 5;

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getUsageToday(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw) as { date?: string; count?: number };
    if (date !== getTodayKey() || typeof count !== "number") return 0;
    return Math.min(count, DAILY_LIMIT);
  } catch {
    return 0;
  }
}

export function incrementUsageToday(): number {
  if (typeof window === "undefined") return 0;
  const today = getTodayKey();
  const current = getUsageToday();
  const next = Math.min(current + 1, DAILY_LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: next }));
  } catch {
    // ignore quota / private mode
  }
  return next;
}

export function getRemainingToday(): number {
  return Math.max(0, DAILY_LIMIT - getUsageToday());
}

export function isLimitReached(): boolean {
  return getUsageToday() >= DAILY_LIMIT;
}

export { DAILY_LIMIT };
