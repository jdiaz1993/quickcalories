import Link from "next/link";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated: February 2025
        </p>

        <div className="mt-8 space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Product description
            </h2>
            <p className="mt-2 leading-relaxed">
              QuickCalories is a calorie and nutrition estimation service. The app lets you describe a meal and receive an estimate of calories and macros (protein, carbohydrates, fat). The free tier offers a limited number of estimates per day; the Pro subscription provides unlimited estimates and additional features.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Subscription and cancellation
            </h2>
            <p className="mt-2 leading-relaxed">
              Pro is a recurring subscription. You can cancel at any time from your account or via the Stripe Customer Portal (Manage subscription on the pricing page). After cancellation, you keep Pro access until the end of the current billing period; no further charges will be made.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Refunds
            </h2>
            <p className="mt-2 leading-relaxed">
              Refund requests are handled in line with our Refund Policy. See the{" "}
              <Link href="/refunds" className="font-medium text-zinc-900 underline dark:text-zinc-50">
                Refund Policy
              </Link>{" "}
              page for details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Contact
            </h2>
            <p className="mt-2 leading-relaxed">
              Questions about these terms? Email us at{" "}
              <a
                href="mailto:support@quickcalories.com"
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                support@quickcalories.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
