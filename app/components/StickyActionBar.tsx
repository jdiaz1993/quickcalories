"use client";

export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-20 left-0 right-0 z-10 mt-auto bg-zinc-50/95 px-4 pb-4 pt-4 backdrop-blur sm:hidden dark:bg-zinc-950/95">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
