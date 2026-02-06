"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("quickcalories_isPro", "true");
      const params = new URLSearchParams(window.location.search);
      setSessionId(params.get("session_id"));
    }
    const timeout = setTimeout(() => {
      router.replace("/?upgraded=1");
    }, 1800);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          You’re now Pro
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Thanks for upgrading to QuickCalories Pro. You now have unlimited
          estimates.
        </p>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
          Redirecting you back to the app…
        </p>
        {sessionId && (
          <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-500">
            Session: {sessionId}
          </p>
        )}
      </div>
    </div>
  );
}

