"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SuccessPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setErrorMessage("Missing session. Complete checkout to unlock Pro.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch("/api/verify-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();

        if (!res.ok || data.ok !== true) {
          setStatus("error");
          setErrorMessage(data.error ?? "Payment could not be verified.");
          return;
        }
        window.location.replace("/account?success=1");
      } catch {
        setStatus("error");
        setErrorMessage("Unable to verify payment.");
      }
    }

    void verify();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Verifying your payment…
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-zinc-900">
          <h1 className="text-xl font-semibold tracking-tight text-red-800 dark:text-red-200">
            Verification failed
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {errorMessage}
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-block w-full rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back to pricing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Redirecting to your account…
        </p>
      </div>
    </div>
  );
}
