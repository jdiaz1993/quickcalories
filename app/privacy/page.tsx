import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-4 py-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated: February 2025
        </p>

        <div className="mt-8 space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Product and data we use
            </h2>
            <p className="mt-2 leading-relaxed">
              QuickCalories is a calorie and nutrition estimation service. When you use the app, we process the meal descriptions you enter to generate estimates. Subscription and payment data are handled by Stripe; we do not store your full payment details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Local storage
            </h2>
            <p className="mt-2 leading-relaxed">
              The app may store data in your browser (e.g. usage limits and preference flags) to provide the service. This data stays on your device unless you clear it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Contact
            </h2>
            <p className="mt-2 leading-relaxed">
              For privacy-related questions, contact us at{" "}
              <a
                href="mailto:privacy@quickcalories.com"
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                privacy@quickcalories.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
