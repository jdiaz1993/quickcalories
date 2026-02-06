import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!secretKey || !priceId) {
      return NextResponse.json(
        { error: "Stripe environment variables are not configured" },
        { status: 500 },
      );
    }

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append(
      "success_url",
      `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    );
    params.append("cancel_url", `${appUrl}/pricing`);

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );

    const data = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const message =
        (data?.error && (data.error.message as string)) ||
        `Stripe error: ${stripeResponse.status}`;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!data.url || typeof data.url !== "string") {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

