"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navLinkClass =
  "text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";
const navScanClass =
  "inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900";

export function Navbar() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user?.id);
    }
    void checkAuth();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          QuickCalories
        </Link>
        <div className="flex items-center gap-6">
          {isLoggedIn ? (
            <>
              <Link href="/account" className={navLinkClass}>
                Account
              </Link>
              <Link href="/history" className={navLinkClass}>
                History
              </Link>
              <Link href="/scan" className={navScanClass}>
                Scan
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={navLinkClass}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={navLinkClass}>
                Login
              </Link>
              <Link href="/pricing" className={navLinkClass}>
                Pricing
              </Link>
              <Link href="/scan" className={navScanClass}>
                Scan
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
