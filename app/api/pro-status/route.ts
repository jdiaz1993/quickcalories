import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ENTITLEMENT_ID = "pro";
const REVENUECAT_API = "https://api.revenuecat.com/v1/subscribers";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonWithCors(
  body: unknown,
  status = 200,
  init?: ResponseInit
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    status,
    headers: { ...CORS_HEADERS, ...init?.headers },
  });
}

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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  return jsonWithCors({ ok: true });
}

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    const token =
      auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (!token) {
      return jsonWithCors({ error: "Not authenticated" }, 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      return jsonWithCors(
        { error: "Server configuration error" },
        500
      );
    }

    const supabase = createAdminClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      return jsonWithCors({ error: "Not authenticated" }, 401);
    }

    const secretKey = process.env.REVENUECAT_SECRET_KEY;
    if (!secretKey || !secretKey.trim()) {
      return jsonWithCors(
        { error: "RevenueCat not configured" },
        500
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
      return jsonWithCors({ error: message }, 502);
    }

    let raw: unknown;
    try {
      raw = await rcRes.json();
    } catch {
      return jsonWithCors(
        { error: "Invalid response from RevenueCat" },
        502
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

    return jsonWithCors({
      isPro: isActive,
      current_period_end,
      provider: "revenuecat",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonWithCors({ error: message }, 500);
  }
}
