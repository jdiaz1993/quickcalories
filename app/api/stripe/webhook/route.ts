import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.trim() === "") {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 500 }
    );
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Process async so we can return 200 quickly; fire-and-forget
  void handleEvent(event);

  if (process.env.NODE_ENV !== "production") {
    console.debug("[webhook] received", event.type);
  }
  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(event: Stripe.Event) {
  try {
    const supabase = createAdminClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = getUserId(session);
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (!userId || !customerId) return;

        await supabase.from("profiles").upsert(
          { user_id: userId, stripe_customer_id: customerId },
          { onConflict: "user_id" }
        );

        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          if (subId) await syncSubscription(supabase, subId, userId, customerId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(supabase, subscription.customer);
        if (!userId) return;
        await upsertSubscription(supabase, userId, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(supabase, subscription.customer);
        if (!userId) return;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("user_id", userId);
        break;
      }

      default:
        break;
    }
  } catch {
    // Log in production; Stripe will retry on non-2xx
  }
}

function getUserId(session: Stripe.Checkout.Session): string | null {
  const ref = session.client_reference_id?.trim();
  if (ref) return ref;
  const uid = (session.metadata as Record<string, string> | null)?.user_id?.trim();
  return uid ?? null;
}

async function resolveUserId(
  supabase: ReturnType<typeof createAdminClient>,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer
): Promise<string | null> {
  const customerId =
    typeof customer === "string" ? customer : (customer as Stripe.Customer)?.id;
  if (!customerId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function syncSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  userId: string,
  customerId: string
) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscription(supabase, userId, sub, customerId);
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer
): string | null {
  return typeof customer === "string" ? customer : (customer as Stripe.Customer)?.id ?? null;
}

async function upsertSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  sub: Stripe.Subscription,
  customerId?: string | null
) {
  const priceId =
    typeof sub.items.data[0]?.price === "string"
      ? sub.items.data[0]?.price
      : sub.items.data[0]?.price?.id ?? null;
  const periodEndUnix = sub.current_period_end;
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;
  const stripeCustomerId = customerId ?? getCustomerId(sub.customer);

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      status: sub.status,
      price_id: priceId,
      current_period_end: periodEnd,
      stripe_customer_id: stripeCustomerId ?? undefined,
      stripe_subscription_id: sub.id,
    },
    { onConflict: "user_id" }
  );
}
