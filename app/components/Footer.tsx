import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 px-4 py-6 dark:border-zinc-800">
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-50">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-50">
          Privacy
        </Link>
        <Link href="/refunds" className="hover:text-zinc-900 dark:hover:text-zinc-50">
          Refunds
        </Link>
        <Link href="/support" className="hover:text-zinc-900 dark:hover:text-zinc-50">
          Support
        </Link>
      </div>
    </footer>
  );
}
