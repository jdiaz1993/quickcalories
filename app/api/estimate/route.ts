import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ESTIMATE_JSON_SCHEMA = `{
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "confidence": "low" | "medium" | "high",
  "notes": string
}`;

type Confidence = "low" | "medium" | "high";

interface EstimateResult {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  notes: string;
}

type PortionSize = "small" | "medium" | "large";

const VALID_PORTIONS: PortionSize[] = ["small", "medium", "large"];

// MVP-only in-memory usage tracker for free tier.
// This lives in-memory per server instance and is NOT suitable for
// real production use. In a real app, move this to Redis/DB and
// combine it with authenticated/signed identifiers.
const deviceUsage = new Map<
  string,
  {
    date: string;
    count: number;
  }
>();

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function incrementAndCheckDeviceLimit(deviceId: string, limit: number): boolean {
  const today = getTodayKey();
  const current = deviceUsage.get(deviceId);
  if (!current || current.date !== today) {
    deviceUsage.set(deviceId, { date: today, count: 1 });
    return true;
  }
  if (current.count >= limit) {
    return false;
  }
  current.count += 1;
  deviceUsage.set(deviceId, current);
  return true;
}

interface ParsedBody {
  meal: string;
  portion: PortionSize;
  details?: string;
}

function parseBody(body: unknown): ParsedBody | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;
  const meal = o.meal;
  if (typeof meal !== "string" || meal.trim() === "") return null;
  const portion = o.portion;
  const portionSize: PortionSize =
    typeof portion === "string" && VALID_PORTIONS.includes(portion as PortionSize)
      ? (portion as PortionSize)
      : "medium";
  const detailsRaw = o.details;
  const details =
    typeof detailsRaw === "string" && detailsRaw.trim() !== ""
      ? detailsRaw.trim()
      : undefined;
  return { meal: meal.trim(), portion: portionSize, details };
}

function parseEstimate(raw: unknown): EstimateResult | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const confidence = o.confidence;
  const validConfidence: Confidence[] = ["low", "medium", "high"];
  if (typeof confidence !== "string" || !validConfidence.includes(confidence as Confidence)) return null;
  const calories = typeof o.calories === "number" ? o.calories : Number(o.calories);
  const protein_g = typeof o.protein_g === "number" ? o.protein_g : Number(o.protein_g);
  const carbs_g = typeof o.carbs_g === "number" ? o.carbs_g : Number(o.carbs_g);
  const fat_g = typeof o.fat_g === "number" ? o.fat_g : Number(o.fat_g);
  const notes = typeof o.notes === "string" ? o.notes : String(o.notes ?? "");
  if (!Number.isFinite(calories) || !Number.isFinite(protein_g) || !Number.isFinite(carbs_g) || !Number.isFinite(fat_g)) {
    return null;
  }
  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein_g),
    carbs_g: Math.round(carbs_g),
    fat_g: Math.round(fat_g),
    confidence: confidence as Confidence,
    notes,
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = parseBody(body);
    if (!parsed) {
      return NextResponse.json(
        { error: "Body must include a non-empty string 'meal'" },
        { status: 400 }
      );
    }

    const deviceIdHeader = request.headers.get("x-device-id") ?? "";
    const deviceId = deviceIdHeader.slice(0, 128);

    // Pro: skip free-tier limit when user has an active subscription in Supabase
    let isPro = false;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .in("status", ["active", "trialing"])
          .limit(1)
          .maybeSingle();
        isPro = !!sub;
      }
    } catch {
      // ignore; treat as free
    }

    if (!isPro && deviceId) {
      const allowed = incrementAndCheckDeviceLimit(deviceId, 5);
      if (!allowed) {
        return NextResponse.json(
          { error: "Daily free limit reached" },
          { status: 429 },
        );
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a nutrition assistant. Estimate macros for the given meal. Respond with a single JSON object only, no markdown or extra text. Schema: ${ESTIMATE_JSON_SCHEMA}. Use confidence "low" for vague descriptions, "medium" for somewhat specific, "high" for very specific. Notes: brief caveats or assumptions. Portion size: when the user specifies portion (small/medium/large), scale your estimates accordingly—treat "medium" as a typical serving, "small" as roughly 0.6–0.75x that, "large" as roughly 1.3–1.5x. Details: when additional details are provided (e.g. sauces, extra cheese, cooking method), incorporate them into the estimate. Return the final scaled values for calories, protein_g, carbs_g, and fat_g.`,
          },
          {
            role: "user",
            content: parsed.details
              ? `Estimate nutrition for this meal. Portion size: ${parsed.portion}. Details: ${parsed.details}. Meal: ${parsed.meal}`
              : `Estimate nutrition for this meal. Portion size: ${parsed.portion}. Meal: ${parsed.meal}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      let message = `OpenAI API error: ${response.status}`;
      try {
        const errJson = JSON.parse(errBody);
        if (errJson.error?.message) message = errJson.error.message;
      } catch {
        if (errBody) message = errBody.slice(0, 200);
      }
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : 400 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid response from OpenAI" },
        { status: 502 }
      );
    }

    let estimateRaw: unknown;
    try {
      estimateRaw = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "OpenAI response was not valid JSON" },
        { status: 502 }
      );
    }

    const result = parseEstimate(estimateRaw);
    if (!result) {
      return NextResponse.json(
        { error: "OpenAI response missing required estimate fields" },
        { status: 502 }
      );
    }

    // Persist to Supabase for logged-in users (best-effort; don't fail the request)
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from("estimates").insert({
          user_id: user.id,
          meal: parsed.meal,
          portion: parsed.portion,
          details: parsed.details ?? null,
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
        });
      }
    } catch {
      // ignore; estimate still returned to client
    }

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
