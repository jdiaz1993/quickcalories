import Link from "next/link";

export default function RefundsPage() {
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
          Refund Policy
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated: February 2025
        </p>

        <div className="mt-8 space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Product and subscriptions
            </h2>
            <p className="mt-2 leading-relaxed">
              QuickCalories Pro is a subscription that gives you unlimited calorie and macro estimates. You are charged in advance for each billing period (e.g. monthly or annually).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Refund within 7 days
            </h2>
            <p className="mt-2 leading-relaxed">
              If you subscribed by mistake or are not satisfied, you may request a full refund within 7 days of the charge. Contact us with the email address used for the purchase and we will process the refund and cancel the subscription. Refunds are not available after 7 days except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Subscription cancellation
            </h2>
            <p className="mt-2 leading-relaxed">
              You can cancel your subscription at any time from the pricing page (Manage subscription) or via Stripe’s billing portal. Cancellation stops future charges; it does not automatically refund the current period. For a refund within 7 days, use the contact below.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Contact
            </h2>
            <p className="mt-2 leading-relaxed">
              Refund requests:{" "}
              <a
                href="mailto:refunds@quickcalories.com"
                className="font-medium text-zinc-900 underline dark:text-zinc-50"
              >
                refunds@quickcalories.com
              </a>
              . Include the email used at checkout and the approximate date of charge.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
