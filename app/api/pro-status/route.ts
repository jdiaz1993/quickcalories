import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ENTITLEMENT_ID = "pro";
const REVENUECAT_API = "https://api.revenuecat.com/v2/subscribers";

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

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REVENUECAT_SECRET_KEY",
] as const;

function getMissingEnv(): string[] {
  return REQUIRED_ENV.filter((key) => {
    const v = process.env[key];
    return !v || (typeof v === "string" && v.trim() === "");
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    const token =
      auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (!token) {
      return jsonWithCors({ error: "Not authenticated" }, 401);
    }

    const missing = getMissingEnv();
    if (missing.length > 0) {
      return jsonWithCors(
        { error: "Missing environment variable", missing },
        500
      );
    }

    const supabase = createAdminClient();
    // Validate JWT and get user via supabase.auth.getUser(accessToken)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      return jsonWithCors({ error: "Not authenticated" }, 401);
    }

    const secretKey = process.env.REVENUECAT_SECRET_KEY!;

    const appUserId = encodeURIComponent(user.id);
    const rcRes = await fetch(`${REVENUECAT_API}/${appUserId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!rcRes.ok) {
      const text = await rcRes.text();
      let errorType: string | undefined;
      try {
        const parsed = JSON.parse(text) as { error?: { type?: string } };
        errorType = parsed?.error?.type;
      } catch {
        // ignore JSON parse errors; fall back to status-only handling
      }

      if (rcRes.status === 404 || errorType === "resource_missing") {
        // No subscriber in RevenueCat → treat as non-Pro
        return jsonWithCors({
          isPro: false,
          current_period_end: null,
          provider: "revenuecat",
        });
      }

      const message = text || rcRes.statusText || "RevenueCat request failed";
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
    return jsonWithCors(
      { error: message, where: "/api/pro-status" },
      500
    );
  }
}
