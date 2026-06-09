import React, { useEffect, useRef, useState } from "react";
import { X, MapPin, Trash2, Search, Maximize2, Minimize2 } from "lucide-react";
import { api } from "../../api";

interface PartnerSpotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotsEvent: any;
  spots: any[];
  loadingSpots: boolean;
  spotForm: {
    name: string;
    spot_type: string;
    latitude: string;
    longitude: string;
    description: string;
  };
  setSpotForm: (form: any) => void;
  onSubmitSpot: (e: React.FormEvent) => void;
  onDeleteSpot: (spotId: number) => void;
}

export default function PartnerSpotsModal({
  isOpen,
  onClose,
  spotsEvent,
  spots,
  loadingSpots,
  spotForm,
  setSpotForm,
  onSubmitSpot,
  onDeleteSpot,
}: PartnerSpotsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [mapType, setMapType] = useState<"google" | "osm" | "voyager">("google");
  const [mapInitialized, setMapInitialized] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Search logic (debounced 300ms)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lat = parseFloat(spotForm.latitude) || undefined;
        const lon = parseFloat(spotForm.longitude) || undefined;
        const results = await api.searchBars(query, lat, lon);
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching bars:", err);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSelectSearchResult = (result: any) => {
    setSearchQuery("");
    setSearchResults([]);

    const latStr = result.latitude.toString();
    const lngStr = result.longitude.toString();

    setSpotForm({
      ...spotForm,
      name: result.name,
      latitude: latStr,
      longitude: lngStr,
    });

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([result.latitude, result.longitude]);
      mapRef.current.setView([result.latitude, result.longitude], 16);
    }
  };

  // Map Initialization
  useEffect(() => {
    if (typeof window === "undefined" || !isOpen) return;

    let mapInstance: any;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");

      // Fix Leaflet marker icons in Next.js build
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      if (!mapContainerRef.current) return;

      const initialLat = parseFloat(spotForm.latitude) || 43.6047;
      const initialLng = parseFloat(spotForm.longitude) || 1.4442;

      mapInstance = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);
      mapRef.current = mapInstance;
      setMapInitialized(true);

      // Add clickable and draggable marker
      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapInstance);
      markerRef.current = marker;

      // Handle marker dragging
      marker.on("dragend", (e: any) => {
        const position = marker.getLatLng();
        setSpotForm((prev: any) => ({
          ...prev,
          latitude: position.lat.toFixed(6),
          longitude: position.lng.toFixed(6),
        }));
      });

      // Handle map clicks
      mapInstance.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSpotForm((prev: any) => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        }));
      });
    });

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
      setMapInitialized(false);
    };
  }, [isOpen]);

  // Update Map Tile Layer based on active mapType
  useEffect(() => {
    if (!mapInitialized || !mapRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    import("leaflet").then((L) => {
      let url = "";
      let attribution = "";
      let maxZoom = 20;

      if (mapType === "google") {
        url = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
        attribution = "&copy; Google Maps";
      } else if (mapType === "osm") {
        url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      } else {
        url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
      }

      tileLayerRef.current = L.tileLayer(url, {
        attribution,
        maxZoom,
        subdomains: mapType === "voyager" ? "abcd" : "abc",
      }).addTo(mapRef.current);
    });
  }, [mapType, mapInitialized]);

  // Invalidate map size on fullscreen toggle to adjust tiles rendering
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 100);
    }
  }, [isMapFullscreen]);

  // Sync marker location when manual latitude/longitude input coordinates change
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const lat = parseFloat(spotForm.latitude);
      const lng = parseFloat(spotForm.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const currentLatLng = markerRef.current.getLatLng();
        if (Math.abs(currentLatLng.lat - lat) > 0.0001 || Math.abs(currentLatLng.lng - lng) > 0.0001) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.panTo([lat, lng]);
        }
      }
    }
  }, [spotForm.latitude, spotForm.longitude]);

  if (!isOpen || !spotsEvent) return null;

  const modalBackdropClass = isMapFullscreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-slate-950"
    : "fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm";

  const modalContainerClass = isMapFullscreen
    ? "w-full h-full bg-slate-950 p-6 flex flex-col relative"
    : "w-full max-w-4xl bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]";

  return (
    <div className={modalBackdropClass}>
      <div className={modalContainerClass}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors z-[130]"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2.5">
          <MapPin className="w-5.5 h-5.5 text-rose-500" />
          Points d'Intérêt & Partenaires
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Événement : <span className="text-rose-400 font-bold">{spotsEvent.name}</span>
        </p>

        <div className={isMapFullscreen
          ? "flex flex-col md:flex-row gap-6 overflow-hidden min-h-0 flex-grow"
          : "grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden min-h-0 flex-grow"
        }>
          {/* Left Column: Add Spot Form & Sidebar */}
          <div className={isMapFullscreen
            ? "w-full md:w-96 flex flex-col py-1 overflow-y-auto pr-1 shrink-0 gap-6"
            : "flex flex-col justify-between py-1 overflow-y-auto pr-1"
          }>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                {isMapFullscreen ? "Détails du point partenaire" : "Ajouter un point sur la carte"}
              </h4>
              <form onSubmit={onSubmitSpot} className="space-y-4">
                
                {/* Search Bar */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rechercher un lieu (ex: Delirium...)</label>
                  <div className="flex items-center gap-2 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Taper pour rechercher et placer..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5" />
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 z-[130] mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl">
                      {searchResults.map((result: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-900 border-b border-slate-900/60 text-xs text-slate-300 hover:text-white transition-colors block"
                        >
                          <div className="font-bold text-slate-200">{result.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {result.city ? `${result.city}, ` : ""}{result.country || ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nom du point</label>
                  <input
                    type="text"
                    required
                    value={spotForm.name}
                    onChange={(e) => setSpotForm({ ...spotForm, name: e.target.value })}
                    placeholder="ex: Le Grand Bar Partenaire, Poste Secours Ouest..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={spotForm.latitude}
                      onChange={(e) => setSpotForm({ ...spotForm, latitude: e.target.value })}
                      placeholder="ex: 43.6047"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={spotForm.longitude}
                      onChange={(e) => setSpotForm({ ...spotForm, longitude: e.target.value })}
                      placeholder="ex: 1.4442"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type de point</label>
                  <select
                    value={spotForm.spot_type}
                    onChange={(e) => setSpotForm({ ...spotForm, spot_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="bar">🍻 Bar Partenaire</option>
                    <option value="security">🛡️ Poste de sécurité</option>
                    <option value="water">💧 Point d'eau</option>
                    <option value="first_aid">🏥 Premiers secours</option>
                    <option value="other">📍 Autre point</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description / Avantages</label>
                  <textarea
                    rows={2}
                    value={spotForm.description}
                    onChange={(e) => setSpotForm({ ...spotForm, description: e.target.value })}
                    placeholder="ex: -10% sur les consos, présence d'un secouriste..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingSpots}
                  className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 disabled:opacity-50 text-sm font-bold text-white transition-all cursor-pointer border-none shadow-lg shadow-rose-500/10"
                >
                  {loadingSpots ? "Ajout en cours..." : "Ajouter le point"}
                </button>
              </form>
            </div>

            {/* If Fullscreen: render the registered spots list here at the bottom of the sidebar! */}
            {isMapFullscreen && (
              <div className="flex flex-col overflow-hidden border-t border-slate-800/80 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Points enregistrés ({spots.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {spots.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic py-2 text-center">Aucun point enregistré.</p>
                  ) : (
                    spots.map((spot) => (
                      <div
                        key={spot.id}
                        className="flex items-start justify-between p-2 rounded-xl bg-slate-950 border border-slate-850 hover:border-slate-800 transition-colors"
                      >
                        <div className="space-y-0.5 flex-grow">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-white">{spot.name}</span>
                            <span className="text-[8px] px-1 py-0.2 rounded border bg-slate-850 border-slate-700 text-slate-400">
                              {spot.spot_type === "bar" ? "🍻" : spot.spot_type === "security" ? "🛡️" : spot.spot_type === "water" ? "💧" : spot.spot_type === "first_aid" ? "🏥" : "📍"}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500 font-mono">
                            {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteSpot(spot.id)}
                          className="p-1 rounded bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 text-rose-450 hover:text-rose-300 transition-colors cursor-pointer shrink-0 ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Map & Spots List (in normal mode) */}
          <div className={isMapFullscreen
            ? "flex-grow flex flex-col min-h-0"
            : "flex flex-col overflow-hidden py-1 gap-4"
          }>
            {/* Map Wrapper */}
            <div key="map-section" className={isMapFullscreen ? "flex-grow flex flex-col min-h-0" : "flex flex-col"}>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {isMapFullscreen ? "Positionnement précis du point partenaire" : "Sélectionner sur la carte"}
                </label>
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-450 transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none"
                >
                  {isMapFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" /> Fermer plein écran
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" /> Plein écran
                    </>
                  )}
                </button>
              </div>

              <div className={isMapFullscreen ? "flex-grow relative min-h-0" : "relative w-full h-48 shrink-0"}>
                {/* Floating Map Type Switcher */}
                <div className="absolute top-3 right-3 z-[15] flex gap-1 p-1 bg-slate-950/90 backdrop-blur-sm border border-slate-800/80 rounded-xl shadow-2xl">
                  <button
                    type="button"
                    onClick={() => setMapType("google")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border-none ${
                      mapType === "google"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    Google Maps
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType("osm")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border-none ${
                      mapType === "osm"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    OSM
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType("voyager")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer border-none ${
                      mapType === "voyager"
                        ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                  >
                    Voyager
                  </button>
                </div>

                {/* Map Container */}
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner"
                  style={{ zIndex: 10 }}
                />
              </div>

              <span className="text-[9px] text-slate-500 mt-1 block">
                * Cliquez n'importe où sur la carte ou déplacez le marqueur pour ajuster.
              </span>
            </div>

            {/* Spots List (ONLY in normal mode, underneath the map) */}
            {!isMapFullscreen && (
              <div className="flex flex-col overflow-hidden min-h-0 flex-grow">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Points enregistrés ({spots.length})</h4>
                </div>

                <div className="space-y-2 overflow-y-auto pr-1 flex-grow max-h-48 md:max-h-none">
                  {loadingSpots && spots.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Chargement des points...</p>
                  ) : spots.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Aucun point d'intérêt enregistré pour cet événement.</p>
                  ) : (
                    <div className="space-y-2">
                      {spots.map((spot) => (
                        <div
                          key={spot.id}
                          className="flex items-start justify-between p-3.5 rounded-xl bg-slate-950/50 border border-slate-850 hover:border-slate-800 transition-colors"
                        >
                          <div className="space-y-1 flex-grow">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{spot.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                  spot.spot_type === "bar"
                                    ? "bg-orange-500/10 border-orange-500/20 text-orange-450"
                                    : spot.spot_type === "security"
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                    : spot.spot_type === "water"
                                    ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-450"
                                    : spot.spot_type === "first_aid"
                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-450"
                                    : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                              >
                                {spot.spot_type === "bar"
                                  ? "🍻 Bar"
                                  : spot.spot_type === "security"
                                  ? "🛡️ Sécurité"
                                  : spot.spot_type === "water"
                                  ? "💧 Eau"
                                  : spot.spot_type === "first_aid"
                                  ? "🏥 Secours"
                                  : "📍 Autre"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono">
                              Lat: {spot.latitude.toFixed(5)} | Lng: {spot.longitude.toFixed(5)}
                            </p>
                            {spot.description && (
                              <p className="text-xs text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-900 mt-1">
                                {spot.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteSpot(spot.id)}
                            className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 text-rose-450 hover:text-rose-300 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Supprimer ce point"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {!isMapFullscreen && (
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer bg-transparent"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
