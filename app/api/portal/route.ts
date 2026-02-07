import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (!secretKey || secretKey.trim() === "") {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is not set" },
        { status: 500 },
      );
    }

    let body: { session_id?: string; customer?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const stripe = new Stripe(secretKey);
    let customerId: string | null = null;

    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;
    const customerParam = typeof body.customer === "string" ? body.customer.trim() : null;

    if (customerParam) {
      customerId = customerParam;
    } else if (sessionId) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
      const customer = checkoutSession.customer;
      if (customer && typeof customer === "string") customerId = customer;
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Missing session_id or customer." },
        { status: 400 },
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl.replace(/\/$/, "")}/account`,
    });

    if (!portalSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a portal URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      const message = err.message ?? "Stripe error";
      const status =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
