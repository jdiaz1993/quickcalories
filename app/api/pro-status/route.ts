import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ENTITLEMENT_ID = "pro";
const REVENUECAT_API = "https://api.revenuecat.com/v1/subscribers";

interface RevenueCatEntitlement {
  expires_date: string | null;
  [key: string]: unknown;
}

interface RevenueCatSubscriber {
  entitlements?: Record<string, RevenueCatEntitlement>;
  [key: string]: unknown;
}

interface RevenueCatResponse {
  subscriber?: RevenueCatSubscriber;
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    const token =
      auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const secretKey = process.env.REVENUECAT_SECRET_KEY;
    if (!secretKey || !secretKey.trim()) {
      return NextResponse.json(
        { error: "RevenueCat not configured" },
        { status: 500 }
      );
    }

    const appUserId = encodeURIComponent(user.id);
    const rcRes = await fetch(`${REVENUECAT_API}/${appUserId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!rcRes.ok) {
      const body = await rcRes.text();
      const message = body || rcRes.statusText || "RevenueCat request failed";
      return NextResponse.json(
        { error: message },
        { status: 502 }
      );
    }

    let raw: unknown;
    try {
      raw = await rcRes.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid response from RevenueCat" },
        { status: 502 }
      );
    }
    const rcData = (raw as { value?: RevenueCatResponse }).value ?? (raw as RevenueCatResponse);
    const subscriber = rcData.subscriber;
    const entitlements = subscriber?.entitlements ?? {};
    const proEntitlement = entitlements[ENTITLEMENT_ID];

    const now = new Date();
    const expiresDate = proEntitlement?.expires_date;
    const isActive =
      !!proEntitlement &&
      (expiresDate == null || new Date(expiresDate) > now);

    const current_period_end: string | null =
      expiresDate != null && expiresDate.trim() !== ""
        ? new Date(expiresDate).toISOString()
        : null;

    const status = isActive ? "active" : "inactive";
    await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        status,
        provider: "revenuecat",
        current_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({
      isPro: isActive,
      current_period_end,
      provider: "revenuecat",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
