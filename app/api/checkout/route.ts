import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getAccessToken(request: NextRequest, body: unknown): string | null {
  // From body
  if (body !== null && typeof body === "object" && "access_token" in body) {
    const t = (body as { access_token: unknown }).access_token;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  // From Authorization: Bearer <token>
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json(
        { error: "Supabase URL or anon key is not set" },
        { status: 500 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const accessToken = getAccessToken(request, body);

    let user: { id: string } | null = null;
    if (accessToken) {
      const supabase = createClient(url, anonKey);
      const { data, error: userError } = await supabase.auth.getUser(accessToken);
      if (!userError && data?.user?.id) user = data.user;
    }
    if (!user) {
      const serverSupabase = await createServerClient();
      const { data: { user: serverUser } } = await serverSupabase.auth.getUser();
      if (serverUser?.id) user = serverUser;
    }
    if (!user?.id) {
      return NextResponse.json(
        { error: "Missing or invalid access_token (or cookie session)" },
        { status: 401 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!secretKey || secretKey.trim() === "") {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is not set" },
        { status: 500 }
      );
    }
    if (!priceId || priceId.trim() === "") {
      return NextResponse.json(
        { error: "STRIPE_PRICE_ID is not set" },
        { status: 500 }
      );
    }
    if (!appUrl || appUrl.trim() === "") {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not set" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      success_url: `${appUrl.replace(/\/$/, "")}/account?success=1`,
      cancel_url: `${appUrl.replace(/\/$/, "")}/pricing`,
    });

    if (!session.url || typeof session.url !== "string") {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
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
