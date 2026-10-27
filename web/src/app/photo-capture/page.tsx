"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Shield, Lock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.pubrush.com";

type Step = "CODE" | "CAMERA" | "PREVIEW" | "SUCCESS";

export default function PhotoCapturePage() {
  const [step, setStep] = useState<Step>("CODE");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In-memory capacity token only (never stored in localStorage/cookies)
  const [uploadToken, setUploadToken] = useState<string | null>(null);

  // Camera stream & capture
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blobToSend, setBlobToSend] = useState<Blob | null>(null);

  // P1-D: Pas de lecture du code depuis la query string pour éviter toute fuite (historique, Referer, logs)
  // La saisie manuelle du code à 10 caractères dans le formulaire est requise.

  // Handle fallback file selection from native device camera
  const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Le fichier dépasse 2 Mo.");
      return;
    }
    stopCamera();
    setBlobToSend(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("PREVIEW");
  };

  // Cleanup camera stream on unmount or state change
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Step 1: Claim upload code
  const handleClaimCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 10) {
      setError("Le code doit comporter exactement 10 caractères.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/photo-mystery/claim-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Code expiré ou invalide. Vérifiez le code dans PubRush.");
      }

      const data = await res.json();
      if (!data.upload_token) {
        throw new Error("Réponse serveur invalide.");
      }

      setUploadToken(data.upload_token);
      setStep("CAMERA");
      await startCamera();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de validation du code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Camera handling
  const startCamera = async () => {
    stopCamera();
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {
          // Autoplay handled
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible d'accéder à la caméra.";
      setError(`Accès caméra refusé ou indisponible : ${msg}`);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    let { videoWidth: width, videoHeight: height } = video;

    if (!width || !height) {
      setError("Image vidéo non prête, veuillez réessayer.");
      return;
    }

    // Limit maximum dimension to 1600px
    const maxDim = 1600;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // Stop camera immediately after capture
    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Erreur lors de la capture de l'image.");
          return;
        }
        setBlobToSend(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setStep("PREVIEW");
      },
      "image/jpeg",
      0.85
    );
  };

  const handleRetake = async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setBlobToSend(null);
    setStep("CAMERA");
    await startCamera();
  };

  // Step 3: Upload with short-lived capacity token
  const handleUpload = async () => {
    if (!blobToSend || !uploadToken) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", blobToSend, "capture.jpg");

      const res = await fetch(`${API_URL}/photo-mystery/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${uploadToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Échec de l'envoi de la photo.");
      }

      // Clear memory references
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setBlobToSend(null);
      setUploadToken(null);
      setStep("SUCCESS");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-neutral-800">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">PubRush — Photo Mystère</h1>
            <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Capture privée & éphémère
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Enter 10-char code */}
        {step === "CODE" && (
          <form onSubmit={handleClaimCode} className="space-y-4">
            <div>
              <label htmlFor="code-input" className="block text-sm font-medium text-neutral-300 mb-2">
                Code de capture
              </label>
              <input
                id="code-input"
                type="text"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EX: A1B2C3D4E5"
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-white uppercase placeholder:text-neutral-600 outline-none transition"
              />
              <p className="text-xs text-neutral-400 mt-2">
                Recopiez le code à 10 caractères affiché dans votre application PubRush. Valable 2 minutes.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.trim().length !== 10}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Activer la caméra
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Live Camera View */}
        {step === "CAMERA" && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-neutral-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2.5 left-2.5 bg-neutral-900/80 backdrop-blur text-xs px-2.5 py-1 rounded-full text-neutral-300 flex items-center gap-1 border border-neutral-700">
                <Lock className="w-3 h-3 text-emerald-400" />
                Audio désactivé
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleNativeFileChange}
            />

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleCapture}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Camera className="w-5 h-5" />
                Prendre la photo
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 border border-neutral-700 transition"
              >
                <Camera className="w-4 h-4 text-neutral-400" />
                Alternative : appareil photo natif du téléphone
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview and Confirmation */}
        {step === "PREVIEW" && previewUrl && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-neutral-800">
              {/* Preview image using standard img */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Aperçu du défi"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={loading}
                className="flex-1 py-3 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl flex items-center justify-center gap-1.5 transition text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Reprendre
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={loading}
                className="flex-1 py-3 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 transition text-sm"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Valider et envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Success state */}
        {step === "SUCCESS" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Photo validée !</h2>
              <p className="text-sm text-neutral-300 mt-2 font-medium">
                Votre photo est chiffrée et prête.
              </p>
              <div className="mt-4 p-4 bg-sky-950/40 border border-sky-800/50 rounded-xl text-sky-200 text-sm leading-relaxed">
                <p className="font-semibold text-white">👉 Retournez maintenant dans l&apos;application PubRush.</p>
                <p className="mt-1 text-xs text-sky-300">
                  (Sur iPhone : touchez « Terminé » en haut à gauche. Sur Android : touchez la flèche retour de votre téléphone.)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  window.close();
                } catch {
                  // Ignore
                }
              }}
              className="mt-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-medium transition"
            >
              Fermer la page
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-400 text-center mt-6 max-w-sm">
        PubRush Photo Mystère — Photos d&apos;objets uniquement, sans visages ni personnes identifiables. Données éphémères purgées automatiquement.
      </p>
    </main>
  );
}
