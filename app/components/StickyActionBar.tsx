"use client";

export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-20 left-0 right-0 z-10 mt-auto bg-gradient-to-t from-stone-100/95 via-stone-50/95 to-transparent px-4 pb-4 pt-4 backdrop-blur-md sm:hidden dark:from-stone-950/95 dark:via-stone-950/90 dark:to-transparent">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
