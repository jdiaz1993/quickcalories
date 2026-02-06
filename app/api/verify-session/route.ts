import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey || secretKey.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "STRIPE_SECRET_KEY is not set" },
        { status: 500 },
      );
    }

    let body: { session_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: "Missing session_id" },
        { status: 400 },
      );
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { ok: false, error: "Not paid" },
        { status: 403 },
      );
    }

    if (session.mode !== "subscription") {
      return NextResponse.json(
        { ok: false, error: "Not a subscription session" },
        { status: 403 },
      );
    }

    if (!session.subscription) {
      return NextResponse.json(
        { ok: false, error: "No subscription on session" },
        { status: 403 },
      );
    }

    if (session.status && session.status !== "complete") {
      return NextResponse.json(
        { ok: false, error: "Session not complete" },
        { status: 403 },
      );
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer as Stripe.Customer)?.id;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription)?.id;

    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { ok: false, error: "Missing customer or subscription id" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      customer: customerId,
      subscription: subscriptionId,
    });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      const message = err.message ?? "Stripe error";
      const status =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
