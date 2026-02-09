"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/app/components/GlassCard";

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

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  low: "bg-zinc-100 text-zinc-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-emerald-100 text-emerald-700",
};

const LOCAL_STORAGE_KEY = "quickcal_local_estimates";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<"camera" | "file">("camera");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Request camera on mount
  useEffect(() => {
    async function initCamera() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setMode("file");
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
          void videoRef.current.play();
        }
      } catch {
        setMode("file");
        setCameraError("Camera permission denied. Using photo upload instead.");
      }
    }

    void initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setImageFile(f);
      setResult(null);
      setError(null);
      setSavedToHistory(false);
      if (f) setPreviewUrl(URL.createObjectURL(f));
    },
    [previewUrl],
  );

  async function handleCapture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 960;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setError(null);
        setSavedToHistory(false);
      },
      "image/jpeg",
      0.9,
    );
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageFile(null);
    setResult(null);
    setError(null);
    setSavedToHistory(false);
  }

  async function handleAnalyze() {
    if (!imageFile) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("image", imageFile);
      const res = await fetch("/api/scan-photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      setResult(data.result ?? null);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveToHistory() {
    if (!result) return;
    setSaveError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { error: insertError } = await supabase.from("estimates").insert({
        user_id: user.id,
        meal: "Photo scan",
        portion: "medium",
        details: "Captured photo",
        calories: result.calories,
        protein_g: result.protein_g,
        carbs_g: result.carbs_g,
        fat_g: result.fat_g,
        confidence: result.confidence,
        notes: result.notes ?? "",
      });
      if (insertError) {
        setSaveError(insertError.message);
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
        meal: "Photo scan",
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
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
          Scan meal
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Use your camera or upload a photo to estimate calories and macros.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Best results with good lighting.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Need barcode instead?{" "}
          <Link
            href="/barcode"
            className="font-semibold text-orange-600 hover:text-orange-700"
          >
            Scan barcode
          </Link>
          .
        </p>
      </header>

      <GlassCard className="w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {mode === "camera" && !cameraError ? (
          <>
            {!previewUrl && (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black">
                <video
                  ref={videoRef}
                  className="h-80 w-full object-cover"
                  playsInline
                  muted
                />
              </div>
            )}
            {previewUrl && (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black">
                <img
                  src={previewUrl}
                  alt="Captured preview"
                  className="h-80 w-full object-cover"
                />
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {!previewUrl ? (
                <button
                  type="button"
                  onClick={handleCapture}
                  className="qc-button w-full"
                >
                  Capture
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="w-1/2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={!imageFile || loading}
                    className="qc-button w-1/2 disabled:opacity-50"
                  >
                    {loading ? "Analyzing…" : "Analyze"}
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {cameraError && (
              <p className="mb-3 text-xs text-zinc-500">{cameraError}</p>
            )}
            <label className="block text-sm font-medium text-zinc-700">
              Upload photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileChange}
                className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-orange-800"
              />
            </label>
            {previewUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-black">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-80 w-full object-cover"
                />
              </div>
            )}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!imageFile || loading}
              className="qc-button mt-4 w-full disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Analyze photo"}
            </button>
          </>
        )}
      </GlassCard>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {result && !loading && (
        <GlassCard className="mt-6 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500">Photo scan result</p>
          <p className="mt-1 text-xl font-bold text-zinc-900">{result.meal}</p>
          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <p className="text-4xl font-bold tracking-tight text-zinc-900">
              {result.calories}
            </p>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              kcal
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center text-zinc-800">
              <p className="font-semibold">Protein</p>
              <p className="mt-0.5 font-mono">{result.protein_g} g</p>
            </div>
            <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center text-zinc-800">
              <p className="font-semibold">Carbs</p>
              <p className="mt-0.5 font-mono">{result.carbs_g} g</p>
            </div>
            <div className="rounded-xl bg-zinc-100 px-3 py-2 text-center text-zinc-800">
              <p className="font-semibold">Fat</p>
              <p className="mt-0.5 font-mono">{result.fat_g} g</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CONFIDENCE_STYLES[result.confidence]}`}
            >
              {result.confidence} confidence
            </span>
          </div>
          {result.notes && (
            <p className="mt-3 text-sm text-zinc-600">{result.notes}</p>
          )}
          <button
            type="button"
            onClick={handleSaveToHistory}
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

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

