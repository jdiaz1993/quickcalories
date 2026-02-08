"use client";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const index = options.indexOf(value);

  return (
    <div className="space-y-2">
      {label && (
        <span className="block text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
      )}
      <div className="relative flex w-full rounded-xl border border-zinc-200 bg-zinc-100 p-1.5 dark:border-zinc-700 dark:bg-zinc-800">
        <div
          className="absolute top-1.5 bottom-1.5 rounded-lg bg-white shadow-sm transition-all duration-200 ease-out dark:bg-zinc-700"
          style={{
            left: `calc(${index * (100 / options.length)}% + 6px)`,
            width: `calc(${100 / options.length}% - 12px)`,
          }}
        />
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`relative z-10 flex-1 rounded-lg px-3 py-3 text-sm font-medium capitalize transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900 ${
              value === opt
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
