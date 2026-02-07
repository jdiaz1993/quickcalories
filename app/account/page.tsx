import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "./AccountActions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [profileRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("stripe_customer_id").eq("user_id", user.id).single(),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .order("current_period_end", { ascending: false })
      .limit(10),
  ]);

  const stripeCustomerId =
    profileRes.data?.stripe_customer_id?.trim() || null;
  const subscriptions = subsRes.data ?? [];
  const activeSub = subscriptions.find(
    (s) => s.status === "active" || s.status === "trialing"
  );
  const plan = activeSub ? "Pro" : "Free";
  const periodEnd = activeSub?.current_period_end ?? null;
  const nextBilling =
    periodEnd
      ? new Date(periodEnd).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <div className="min-h-screen px-4 py-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back
        </Link>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Account
        </h1>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Plan
          </h2>
          <p className="mt-1 text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {plan}
          </p>
          {nextBilling && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Next billing date: {nextBilling}
            </p>
          )}
        </section>

        <AccountActions stripeCustomerId={stripeCustomerId} />
      </div>
    </div>
  );
}
