import { NextResponse } from "next/server";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Confidence = "low" | "medium" | "high";

interface ScanResult {
  meal: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  notes: string;
}

const SCHEMA_DESC = `JSON object with: "meal" (string, short description of the food), "calories" (number), "protein_g" (number), "carbs_g" (number), "fat_g" (number), "confidence" ("low"|"medium"|"high"), "notes" (string, brief caveats).`;

function parseScanResult(raw: unknown): ScanResult | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const meal = typeof o.meal === "string" ? o.meal.trim() : String(o.meal ?? "").trim();
  if (!meal) return null;
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
    meal: meal || "Photo",
    calories: Math.round(Math.max(0, calories)),
    protein_g: Math.round(Math.max(0, protein_g)),
    carbs_g: Math.round(Math.max(0, carbs_g)),
    fat_g: Math.round(Math.max(0, fat_g)),
    confidence: confidence as Confidence,
    notes,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid 'image' file" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 5MB or smaller" },
        { status: 400 }
      );
    }
    const type = file.type?.toLowerCase() ?? "";
    if (!ALLOWED_TYPES.some((t) => type.startsWith(t) || type === t)) {
      return NextResponse.json(
        { error: "File must be an image (JPEG, PNG, WebP, or GIF)" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = file.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

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
            content: `You are a nutrition assistant. Look at the image of food and estimate what the meal is and its nutrition. Respond with a single JSON object only, no markdown or extra text. Schema: ${SCHEMA_DESC}. Use confidence "low" for unclear or partial images, "medium" for recognizable portions, "high" for clear and identifiable meals. Notes: brief caveats (e.g. portion assumed, items not fully visible).`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Estimate the meal and nutrition for this image. Return JSON only." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
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

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "OpenAI response was not valid JSON" },
        { status: 502 }
      );
    }

    const result = parseScanResult(raw);
    if (!result) {
      return NextResponse.json(
        { error: "OpenAI response missing required fields" },
        { status: 502 }
      );
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
