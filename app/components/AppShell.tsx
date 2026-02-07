"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* Lucide-style inline icons (no external package) */
function IconCalculator({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}
function IconHistory({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user?.id);
      if (!user?.id) {
        setIsPro(false);
        return;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .limit(1)
        .maybeSingle();
      setIsPro(!!data);
    }
    void checkAuth();
  }, []);

  const activeIndex = tabs.findIndex(
    (t) => pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href))
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal top bar: logo left, Account/Login right */}
      <header className="sticky top-0 z-20 flex min-h-[52px] items-center border-b border-zinc-200/60 bg-white/95 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/95">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--qc-accent)] text-white">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span>QuickCalories</span>
          </Link>
          <div className="flex items-center gap-2">
            {isPro && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                Pro
              </span>
            )}
            {isLoggedIn ? (
              <Link
                href="/account"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                Account
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  Login
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  Pricing
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Desktop: iOS-style segmented control in rounded pill */}
      <nav
        className="hidden border-b border-zinc-200/60 bg-white/80 dark:border-zinc-800/60 dark:bg-zinc-950/80 sm:block"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex w-full max-w-[1400px] justify-center px-4 py-3 sm:px-6 lg:px-10 xl:px-12 2xl:px-16">
          <div className="relative flex w-full max-w-[280px] rounded-full bg-zinc-200/80 p-1 dark:bg-zinc-800/60">
            {/* Sliding active pill */}
            <div
              className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-all duration-200 ease-out dark:bg-zinc-700"
              style={{
                left: `calc(${activeIndex} * (100% / ${tabs.length}) + 4px)`,
                width: `calc(100% / ${tabs.length} - 8px)`,
              }}
            />
            <div className="relative flex w-full">
              {tabs.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "text-zinc-900 dark:text-zinc-50"
                        : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="min-h-[calc(100vh-140px)] flex-1 bg-gradient-to-b from-zinc-50 via-white to-emerald-50/30 py-6 pb-24 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20 sm:pb-10 lg:py-10 lg:pb-14">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16">{children}</div>
      </main>

      {/* Mobile: bottom tab bar (Estimate / History / Account) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center border-t border-zinc-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/95 sm:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex w-full max-w-[1400px] justify-around px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 rounded-xl px-6 py-2 transition-colors ${
                  active
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-[11px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
