"use client";

const tintMap = {
  protein: "emerald",
  carbs: "amber",
  fat: "rose",
} as const;

type TintKey = keyof typeof tintMap;

const ringColors: Record<TintKey, { stroke: string; text: string; bg: string }> = {
  protein: {
    stroke: "stroke-emerald-500 dark:stroke-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
  },
  carbs: {
    stroke: "stroke-amber-500 dark:stroke-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
  },
  fat: {
    stroke: "stroke-rose-500 dark:stroke-rose-400",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-500/10 dark:bg-rose-400/10",
  },
};

export function MacroRing({
  label,
  value,
  tint = "protein",
  max = 100,
}: {
  label: string;
  value: number;
  tint?: TintKey;
  max?: number;
}) {
  const colors = ringColors[tint];
  const pct = Math.min(100, (value / max) * 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl p-4 ${colors.bg} transition-opacity duration-300`}
    >
      <div className="relative inline-flex items-center justify-center">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-zinc-200/80 dark:stroke-zinc-600/60"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={`${colors.stroke} transition-[stroke-dashoffset] duration-500 ease-out`}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
          />
        </svg>
        <span className="absolute text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {value}
        </span>
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
        {label}
      </span>
    </div>
  );
}
