import Link from "next/link";

export default function SupportPage() {
  return (
    <div className="min-h-screen px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Support
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Get help with QuickCalories
        </p>

        <div className="mt-8 space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              FAQs
            </h2>
            <p className="mt-2 leading-relaxed">
              For common questions about subscriptions, refunds, and account management, see our{" "}
              <Link href="/refunds" className="font-medium text-zinc-900 underline dark:text-zinc-50">
                Refunds
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="font-medium text-zinc-900 underline dark:text-zinc-50">
                Terms
              </Link>{" "}
              pages.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Contact us
            </h2>
            <p className="mt-2 leading-relaxed">
              For technical issues, billing questions, or feedback, email us at{" "}
              <a
                href="mailto:support@quickcalories.com"
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                support@quickcalories.com
              </a>
              . We’ll get back to you as soon as we can.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
