"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const tabClass =
  "flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";
const tabInactive =
  "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
const tabActive =
  "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50";

function IconCalculator({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}
function IconHistory({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

const tabs = [
  { href: "/", label: "Estimate", icon: IconCalculator },
  { href: "/history", label: "History", icon: IconHistory },
  { href: "/account", label: "Account", icon: IconUser },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user?.id);
    }
    void checkAuth();
  }, []);

  const linkClass =
    "text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            QuickCalories
          </Link>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link href="/account" className={linkClass}>
                Account
              </Link>
            ) : (
              <>
                <Link href="/login" className={linkClass}>
                  Login
                </Link>
                <Link href="/pricing" className={linkClass}>
                  Pricing
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Horizontal tab nav (desktop only — under header) */}
      <nav
        className="hidden border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 sm:block"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-4xl gap-1 px-4 py-2">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`${tabClass} ${active ? tabActive : tabInactive}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content — padding bottom for fixed nav on mobile */}
      <main className="flex-1 px-4 py-6 pb-24 sm:pb-6">
        <div className="mx-auto max-w-md">{children}</div>
      </main>

      {/* Bottom tab nav (mobile only) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white/95 py-2 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-center gap-2 px-2">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors ${active ? tabActive : tabInactive}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
