"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Beer,
  Users,
  MapPin,
  CheckCircle2,
  Navigation,
  Sparkles,
  ExternalLink,
  Radio,
  Clock,
  AlertCircle,
  Smartphone,
  PartyPopper,
} from "lucide-react";

interface BarathonStop {
  id: number;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  stop_order: number;
  is_completed: boolean;
  is_active: boolean;
}

interface BarathonPreview {
  id: number;
  name: string;
  join_code: string;
  status: string;
  created_by_user_id: number;
  organizer_name: string;
  stops_count: number;
  participants_count: number;
  current_stop?: BarathonStop | null;
  all_stops: BarathonStop[];
}

interface GuestSession {
  token: string;
  user_id: number;
  username: string;
  barathon_id: number;
  barathon_name: string;
  assigned_role?: string | null;
}

interface FriendLocation {
  user_id: number;
  username: string;
  latitude: number;
  longitude: number;
  is_guest?: boolean;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.pubrush.com";

export default function JoinBarathonPage() {
  const params = useParams<{ code?: string }>();
  const rawCode = params?.code ? decodeURIComponent(params.code) : "";
  const code = rawCode.trim().toUpperCase();

  const [preview, setPreview] = useState<BarathonPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [usernameInput, setUsernameInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [session, setSession] = useState<GuestSession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [isSousSolMode, setIsSousSolMode] = useState(false);
  const [friendsLocations, setFriendsLocations] = useState<Record<number, FriendLocation>>({});
  const socketRef = useRef<WebSocket | null>(null);

  // Restore guest session from localStorage on mount
  useEffect(() => {
    if (!code) return;
    try {
      const saved = localStorage.getItem(`pubrush_guest_${code}`);
      if (saved) {
        const parsed = JSON.parse(saved) as GuestSession;
        if (parsed?.token && parsed?.username) {
          setSession(parsed);
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [code]);

  // Load barathon preview by join code
  async function loadPreview(silent = false) {
    if (!code) return;
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`${API_BASE_URL}/barathons/by-code/${code}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Ce barathon n'existe pas ou est introuvable.");
      }
      const data = (await res.json()) as BarathonPreview;
      setPreview(data);
      setFetchError(null);
      setIsSousSolMode(false);
      try {
        localStorage.setItem(`pubrush_preview_cache_${code}`, JSON.stringify(data));
      } catch {
        // Ignore
      }
    } catch (err: unknown) {
      try {
        const cached = localStorage.getItem(`pubrush_preview_cache_${code}`);
        if (cached) {
          setPreview(JSON.parse(cached));
          setIsSousSolMode(true);
          setFetchError(null);
          return;
        }
      } catch {
        // Ignore
      }
      if (!silent) {
        setFetchError(err instanceof Error ? err.message : "Erreur de connexion.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (code) {
      void loadPreview();
    }
  }, [code]);

  // WebSocket real-time connection for active guests
  useEffect(() => {
    if (!session?.token || !preview?.id) return;

    const barathonId = preview.id;
    const wsBaseUrl = API_BASE_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBaseUrl}/ws/barathons/${barathonId}?token=${encodeURIComponent(
      session.token
    )}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setIsSousSolMode(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
        setIsSousSolMode(true);
      };

      ws.onerror = () => {
        setWsConnected(false);
        setIsSousSolMode(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "BARATHON_NEXT_STEP" || msg.type === "BARATHON_STOP_COMPLETED") {
            void loadPreview(true);
            showToast("Nouvelle étape en cours ! 🚀");
          } else if (msg.type === "BARATHON_STOP_REPLACED") {
            void loadPreview(true);
            const { new_name, old_name } = msg.payload || {};
            showToast(`L'étape "${old_name}" a été remplacée par "${new_name}" ! 🔄`);
          } else if (msg.type === "BARATHON_STOP_ADDED") {
            void loadPreview(true);
            const { added_stop } = msg.payload || {};
            showToast(`Nouvelle étape ajoutée : ${added_stop?.name || "Nouveau bar"} ➕`);
          } else if (msg.type === "BARATHON_PARTICIPANT_JOINED") {
            void loadPreview(true);
            const user = msg.payload?.user;
            if (user && user.username !== session.username) {
              showToast(`${user.username} vient de rejoindre le barathon ! 🎉`);
            }
          } else if (msg.type === "FRIEND_LOCATION_UPDATE") {
            const loc = msg.payload;
            if (loc && loc.user_id !== session?.user_id) {
              setFriendsLocations((prev) => ({ ...prev, [loc.user_id]: loc }));
            }
          } else if (msg.type === "FRIENDS_LOCATIONS_SNAPSHOT") {
            const list = msg.payload?.locations || [];
            const map: Record<number, FriendLocation> = {};
            for (const loc of list) {
              if (loc.user_id !== session?.user_id) {
                map[loc.user_id] = loc;
              }
            }
            setFriendsLocations((prev) => ({ ...prev, ...map }));
          } else if (msg.type === "BARATHON_STOPPED" || msg.type === "BARATHON_FINISHED") {
            void loadPreview(true);
            showToast("Le barathon est terminé ! 🏁");
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };
    } catch {
      // WS connection failure fallback
    }

    // Quiet 15s polling fallback to keep synced
    const interval = setInterval(() => {
      void loadPreview(true);
    }, 15000);

    return () => {
      clearInterval(interval);
      if (ws) {
        ws.close();
      }
    };
  }, [session?.token, preview?.id, session?.username]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  }

  // Handle guest join submission
  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setJoinError("Merci d'indiquer ton prénom ou pseudo !");
      return;
    }

    try {
      setJoining(true);
      setJoinError(null);

      const res = await fetch(`${API_BASE_URL}/barathons/join-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          username: cleanUsername,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Impossible de rejoindre ce barathon.");
      }

      const joinData = await res.json();
      const newSession: GuestSession = {
        token: joinData.access_token,
        user_id: joinData.user_id,
        username: joinData.username,
        barathon_id: joinData.barathon_id,
        barathon_name: joinData.barathon_name,
        assigned_role: joinData.assigned_role,
      };

      localStorage.setItem(`pubrush_guest_${code}`, JSON.stringify(newSession));
      setSession(newSession);
      showToast(`Bienvenue dans le barathon, ${cleanUsername} ! 🍻`);
      void loadPreview(true);
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setJoining(false);
    }
  }

  // Current active stop
  const currentStop = useMemo(() => {
    if (!preview) return null;
    if (preview.current_stop) return preview.current_stop;
    return preview.all_stops.find((s) => s.is_active) || preview.all_stops[0] || null;
  }, [preview]);

  const currentStopIndex = useMemo(() => {
    if (!preview || !currentStop) return 0;
    const idx = preview.all_stops.findIndex((s) => s.id === currentStop.id);
    return idx >= 0 ? idx : 0;
  }, [preview, currentStop]);

  function getGoogleMapsUrl(stop: BarathonStop) {
    const query = encodeURIComponent(`${stop.name} ${stop.address || ""}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-bounce mb-4">
          <Beer className="w-8 h-8 text-amber-400" />
        </div>
        <p className="text-slate-400 text-sm font-medium animate-pulse">
          Chargement du barathon...
        </p>
      </div>
    );
  }

  // Error / Not found state
  if (fetchError || !preview) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Barathon introuvable</h1>
        <p className="text-slate-400 text-sm max-w-xs mb-6">
          {fetchError || "Le code d'invitation n'est pas valide ou a expiré."}
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
        >
          Retourner à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 z-50 px-4 w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-semibold px-4 py-3 rounded-2xl shadow-xl shadow-amber-500/20 flex items-center gap-3">
            <Sparkles className="w-5 h-5 shrink-0" />
            <span className="text-sm flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <header className="w-full max-w-md px-6 py-4 flex items-center justify-between border-b border-slate-900/60">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Beer className="w-4 h-4 text-slate-950 font-bold" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Pub<span className="text-amber-400">Rush</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {session && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                wsConnected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              <Radio className={`w-3 h-3 ${wsConnected ? "animate-pulse text-emerald-400" : ""}`} />
              {wsConnected ? "En direct" : "Synchronisé"}
            </span>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-md px-4 py-6 flex-1 flex flex-col">
        {!session ? (
          /* ==================================================================== */
          /* STATE A: PRE-JOIN INVITATION                                         */
          /* ==================================================================== */
          <div className="flex flex-col gap-5">
            {/* Header invitation card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 p-6 shadow-2xl">
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
                <PartyPopper className="w-3.5 h-3.5" />
                <span>Invitation à rejoindre</span>
              </div>

              <h1 className="text-2xl font-black text-white tracking-tight mb-2">
                {preview.name}
              </h1>

              <p className="text-sm text-slate-400 mb-5">
                Organisé par{" "}
                <span className="text-amber-400 font-semibold">
                  {preview.organizer_name}
                </span>
              </p>

              {/* Quick stats pills */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Beer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {preview.stops_count}
                    </div>
                    <div className="text-xs text-slate-400">Bars prévus</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {preview.participants_count}
                    </div>
                    <div className="text-xs text-slate-400">Amis présents</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Guest Join Form */}
            <div className="rounded-3xl bg-slate-900/70 border border-slate-800/80 p-6 shadow-xl backdrop-blur-md">
              <h2 className="text-base font-bold text-white mb-1">
                Rejoins la fête en 1 seconde !
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Aucun compte ni mot de passe requis. Donne juste ton prénom pour que tes amis te reconnaissent.
              </p>

              <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3">
                <div>
                  <label
                    htmlFor="username"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Ton prénom ou pseudo
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    maxLength={30}
                    placeholder="Ex: Sophie, Thomas, Alex..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm transition"
                    autoFocus
                  />
                </div>

                {joinError && (
                  <p className="text-xs text-red-400 font-medium">
                    {joinError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={joining || !usernameInput.trim()}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {joining ? (
                    <span>Connexion...</span>
                  ) : (
                    <>
                      <span>Rejoindre la fête !</span>
                      <Beer className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Deep link app button for users with the native app installed */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-slate-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    Tu as l&apos;application mobile ?
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Ouvrir directement dans PubRush
                  </div>
                </div>
              </div>

              <a
                href={`pubrush://join/${code}`}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition"
              >
                Ouvrir l&apos;app
              </a>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* STATE B: ACTIVE LIVE COMPANION (POST-JOIN)                           */
          /* ==================================================================== */
          <div className="flex flex-col gap-5">
            {/* Identity & Barathon Header */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800/80 px-4 py-3 rounded-2xl">
              <div>
                <div className="text-xs text-slate-400">Connecté en tant que</div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>{session.username}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                    Invité
                  </span>
                </div>
              </div>

              {session.assigned_role && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Ton rôle
                  </div>
                  <div className="text-xs font-bold text-amber-400">
                    🎭 {session.assigned_role}
                  </div>
                </div>
              )}
            </div>

            {/* Mode Sous-sol / Offline banner */}
            {isSousSolMode && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <span className="text-xl">🔦</span>
                <div>
                  <div className="font-bold text-white mb-0.5">Mode Sous-sol actif</div>
                  <div>Réseau indisponible. La page fonctionne en mode local et se synchronisera dès que le signal sera rétabli.</div>
                </div>
              </div>
            )}

            {/* Hero Current Stop Card */}
            {currentStop ? (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-amber-500/30 p-6 shadow-2xl shadow-amber-500/5">
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Étape {currentStopIndex + 1} sur {preview.all_stops.length}
                  </span>

                  <span className="text-xs text-slate-400">
                    {preview.status === "started" ? "En cours 🍻" : "À venir"}
                  </span>
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight mb-1">
                  {currentStop.name}
                </h2>

                {currentStop.address && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{currentStop.address}</span>
                  </p>
                )}

                {/* Google Maps CTA */}
                <a
                  href={getGoogleMapsUrl(currentStop)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Itinéraire Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 text-center">
                <Beer className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Aucune étape active actuellement.</p>
              </div>
            )}

            {/* Timeline Route Progression */}
            <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Beer className="w-4 h-4 text-amber-400" />
                  <span>Parcours du barathon</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {preview.all_stops.filter((s) => s.is_completed).length} / {preview.all_stops.length} validés
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {preview.all_stops.map((stop, idx) => {
                  const isCurrent = currentStop?.id === stop.id;
                  const isDone = stop.is_completed;

                  return (
                    <div
                      key={stop.id}
                      className={`flex items-start gap-3 p-3 rounded-2xl transition border ${
                        isCurrent
                          ? "bg-amber-500/10 border-amber-500/40"
                          : isDone
                          ? "bg-slate-950/40 border-slate-800/40 opacity-70"
                          : "bg-slate-950/60 border-slate-800/60"
                      }`}
                    >
                      {/* Step Indicator */}
                      <div
                        className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                          isDone
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : isCurrent
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold truncate ${
                              isCurrent
                                ? "text-amber-300 font-bold"
                                : isDone
                                ? "text-slate-400 line-through"
                                : "text-slate-200"
                            }`}
                          >
                            {stop.name}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">
                              Actuel
                            </span>
                          )}
                        </div>

                        {stop.address && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {stop.address}
                          </div>
                        )}
                      </div>

                      {/* Link to maps */}
                      <a
                        href={getGoogleMapsUrl(stop)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Ouvrir dans Google Maps"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Friends Live Location Widget */}
            {Object.keys(friendsLocations).length > 0 && (
              <div className="rounded-3xl bg-slate-900/60 border border-slate-800/80 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Amis connectés ({Object.keys(friendsLocations).length})</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En direct
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {Object.values(friendsLocations).map((friend) => (
                    <div
                      key={friend.user_id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                          {friend.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{friend.username}</span>
                            {friend.is_guest && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Invité
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">Position partagée</div>
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${friend.latitude},${friend.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Carte</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom info banner */}
            <div className="text-center py-4">
              <p className="text-xs text-slate-500">
                Tu es connecté au barathon via le Web Companion PubRush.
                <br />
                La page se synchronise automatiquement en direct ! ⚡
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
