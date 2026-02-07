"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm ${className ?? ""}`}
      aria-hidden
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </span>
  );
}

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

  const linkClass =
    "text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";

  const activeIndex = tabs.findIndex(
    (t) => pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href))
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar with logo mark */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            <LogoMark />
            <span>QuickCalories</span>
          </Link>
          <div className="flex items-center gap-3">
            {isPro && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                Pro
              </span>
            )}
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

      {/* Desktop: segmented pill nav */}
      <nav
        className="hidden border-b border-zinc-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80 sm:block"
        aria-label="Main navigation"
      >
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="relative inline-flex w-full max-w-xs rounded-2xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
            {/* Animated active pill */}
            <div
              className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm transition-all duration-200 ease-out dark:bg-zinc-700"
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
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
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

      {/* Main content — gradient bg, max-w-lg, more spacing */}
      <main className="min-h-[60vh] flex-1 bg-gradient-to-b from-zinc-50 via-white to-emerald-50/30 px-4 py-8 pb-28 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20 sm:pb-10">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>

      {/* Mobile: bottom tab nav as segmented pills */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200/80 bg-white/90 py-2.5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 sm:hidden"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg gap-1 px-3">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-zinc-200/90 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
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
