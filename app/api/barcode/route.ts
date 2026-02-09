import { NextRequest, NextResponse } from "next/server";

const CODE_REGEX = /^\d{8,14}$/;

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  brands_tags?: string[];
  nutriments?: Record<string, number | undefined>;
  status?: number;
}

function num(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

async function lookupBarcode(code: string) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${code}.json`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: "Product not found" },
      { status: 404 }
    );
  }

  const data = (await res.json()) as { status?: number; product?: OFFProduct };
  const product = data?.product;
  if (!product || data.status !== 1) {
    return NextResponse.json(
      { error: "Product not found" },
      { status: 404 }
    );
  }

  const nutriments = product.nutriments ?? {};
  const caloriesServing = num(nutriments["energy-kcal_serving"]);
  const calories100 = num(nutriments["energy-kcal_100g"]);
  const proteinServing = num(nutriments["proteins_serving"]);
  const protein100 = num(nutriments["proteins_100g"]);
  const carbsServing = num(nutriments["carbohydrates_serving"]);
  const carbs100 = num(nutriments["carbohydrates_100g"]);
  const fatServing = num(nutriments["fat_serving"]);
  const fat100 = num(nutriments["fat_100g"]);

  const hasServing =
    caloriesServing > 0 || proteinServing > 0 || carbsServing > 0 || fatServing > 0;
  const has100 =
    calories100 > 0 || protein100 > 0 || carbs100 > 0 || fat100 > 0;

  const calories = Math.round(hasServing ? caloriesServing : calories100);
  const protein_g = Math.round(hasServing ? proteinServing : protein100);
  const carbs_g = Math.round(hasServing ? carbsServing : carbs100);
  const fat_g = Math.round(hasServing ? fatServing : fat100);

  const missing: string[] = [];
  if (calories === 0) missing.push("calories");
  if (protein_g === 0) missing.push("protein");
  if (carbs_g === 0) missing.push("carbs");
  if (fat_g === 0) missing.push("fat");

  let confidence: "high" | "medium" | "low" = "medium";
  if (hasServing && missing.length === 0) confidence = "high";
  else if (has100 && missing.length === 0) confidence = "medium";
  else confidence = "low";

  const sourceNote = hasServing
    ? "Values per serving. Source: Open Food Facts."
    : has100
      ? "Values per 100g. Source: Open Food Facts."
      : "Source: Open Food Facts.";
  const missingNote =
    missing.length > 0 ? ` Missing: ${missing.join(", ")}.` : "";
  const notes = sourceNote + missingNote;

  const productName =
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    "Product";
  const brand = product.brands?.trim() || "";
  const meal = brand ? `${brand} ${productName}`.trim() : productName;

  const result = {
    meal,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    confidence,
    notes,
  };

  return NextResponse.json({ result });
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
    if (!CODE_REGEX.test(code)) {
      return NextResponse.json(
        { error: "Barcode must be 8–14 digits" },
        { status: 400 }
      );
    }
    return await lookupBarcode(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
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
    const codeRaw =
      body !== null && typeof body === "object" && "code" in body
        ? (body as { code: unknown }).code
        : undefined;
    const code = typeof codeRaw === "string" ? codeRaw.trim() : String(codeRaw ?? "").trim();
    const digits = code.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 14) {
      return NextResponse.json(
        { error: "Barcode must be 8–14 digits" },
        { status: 400 }
      );
    }
    return await lookupBarcode(digits);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
