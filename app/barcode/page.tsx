"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/app/components/GlassCard";

type Confidence = "low" | "medium" | "high";

interface BarcodeResult {
  meal: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  notes: string;
}

const LOCAL_STORAGE_KEY = "quickcal_local_estimates";

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-emerald-100 text-emerald-700",
};

declare const BarcodeDetector: {
  new (options?: { formats?: string[] }): {
    detect: (
      image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    ) => Promise<{ rawValue: string }[]>;
  };
};

export default function BarcodePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectedRef = useRef(false);

  const [supportsDetector, setSupportsDetector] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [manualCode, setManualCode] = useState("");
  const [currentCode, setCurrentCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Feature detection for BarcodeDetector
  useEffect(() => {
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      setSupportsDetector(true);
    }
  }, []);

  const stopScanner = useCallback(() => {
    setScanning(false);
    detectedRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopScanner();
    },
    [stopScanner],
  );

  async function startScanner() {
    setError(null);
    setNotFound(false);
    setResult(null);
    setSavedToHistory(false);
    if (!supportsDetector) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError("Camera not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
      });
      setScanning(true);
      detectedRef.current = false;
      const loop = async () => {
        if (!scanning || !videoRef.current || detectedRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const first = codes?.[0];
          if (first?.rawValue) {
            let digits = first.rawValue.replace(/\D/g, "");
            if (digits.length >= 8 && digits.length <= 14) {
              detectedRef.current = true;
              stopScanner();
              setCurrentCode(digits);
              void lookupCode(digits);
              return;
            }
          }
        } catch {
          // ignore detection errors
        }
        if (scanning && !detectedRef.current) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setCameraError("Could not start camera. Use manual entry instead.");
      stopScanner();
    }
  }

  async function lookupCode(code: string) {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setResult(null);
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.status === 404) {
        setNotFound(true);
        setError(data.error ?? "Product not found");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Lookup failed");
        return;
      }
      const r = data.result as BarcodeResult;
      setResult({
        meal: r.meal,
        calories: r.calories,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        confidence: r.confidence,
        notes: r.notes,
      });
      setSavedToHistory(false);
      setSaveError(null);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleManualLookup() {
    const digits = manualCode.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 14) {
      setError("Enter a valid barcode (8–14 digits).");
      setNotFound(false);
      return;
    }
    setCurrentCode(digits);
    void lookupCode(digits);
  }

  async function handleSaveToHistory() {
    if (!result) return;
    setSaveError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { error } = await supabase.from("estimates").insert({
        user_id: user.id,
        meal: result.meal,
        portion: "medium",
        details: `Barcode: ${currentCode}`,
        calories: result.calories,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fat_g: result.fat_g,
        confidence: result.confidence,
        notes: result.notes ?? "",
      });
      if (error) {
        setSaveError(error.message);
        return;
      }
      setSavedToHistory(true);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        meal: result.meal,
        result: {
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
        },
        createdAt: new Date().toISOString(),
      });
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(arr));
      setSavedToHistory(true);
    } catch {
      setSaveError("Could not save locally");
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-zinc-50 px-4 pb-24 pt-6 dark:bg-zinc-950">
      <header className="mb-6">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Scan Barcode
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Works best in Chrome/Android. iPhone may require manual entry.
        </p>
      </header>

      <GlassCard className="w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {supportsDetector && (
          <div className="mb-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Live scanner
            </p>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black">
              <video
                ref={videoRef}
                className="w-full"
                style={{ aspectRatio: "4 / 5" }}
                playsInline
                muted
              />
            </div>
            {cameraError && (
              <p className="text-xs text-red-600" role="alert">
                {cameraError}
              </p>
            )}
            <div className="flex gap-2">
              {!scanning ? (
                <button
                  type="button"
                  onClick={() => void startScanner()}
                  className="qc-button w-full"
                  disabled={loading}
                >
                  {scanning ? "Scanning…" : "Start scanner"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        )}

        {/* Manual input fallback / always available */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Manual entry
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter barcode (UPC/EAN)"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value);
                setError(null);
                setNotFound(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-400"
            />
            <button
              type="button"
              onClick={handleManualLookup}
              disabled={loading}
              className="shrink-0 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Lookup
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {notFound && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
            <span>Product not found. Try estimating with AI.</span>
            <Link
              href="/"
              className="rounded-full border border-orange-500 px-2 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-50"
            >
              Estimate with AI
            </Link>
          </div>
        )}
      </GlassCard>

      {result && (
        <GlassCard className="mt-6 w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {result.meal}
          </p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {result.calories}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              kcal
            </span>
            <span
              className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${CONFIDENCE_CLASS[result.confidence]}`}
            >
              {result.confidence} confidence
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              <p className="font-semibold">Protein</p>
              <p className="mt-0.5 font-mono">{result.protein_g} g</p>
            </div>
            <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              <p className="font-semibold">Carbs</p>
              <p className="mt-0.5 font-mono">{result.carbs_g} g</p>
            </div>
            <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              <p className="font-semibold">Fat</p>
              <p className="mt-0.5 font-mono">{result.fat_g} g</p>
            </div>
          </div>
          {result.notes && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              {result.notes}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSaveToHistory()}
            disabled={savedToHistory}
            className="qc-button mt-4 w-full disabled:opacity-70"
          >
            {savedToHistory ? "Saved to history" : "Save to history"}
          </button>
          {saveError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {saveError}
            </p>
          )}
        </GlassCard>
      )}
    </div>
  );
}

