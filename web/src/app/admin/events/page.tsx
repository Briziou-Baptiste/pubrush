"use client";

import React, { useEffect, useState } from "react";
import { 
  Calendar, 
  Map, 
  Plus, 
  Trash2, 
  Edit, 
  Link2, 
  Link2Off,
  CheckCircle2, 
  XCircle, 
  ShieldAlert,
  Sparkles,
  Settings,
  Globe,
  Tag,
  Code
} from "lucide-react";
import { api } from "../api";

export default function AdminEventsAndFilters() {
  const [activeTab, setActiveTab] = useState<"events" | "filters">("events");
  const [events, setEvents] = useState<any[]>([]);
  const [filters, setFilters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Alert/Toast state
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form / Modal States
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [eventForm, setEventForm] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true
  });

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<any | null>(null);
  const [filterForm, setFilterForm] = useState({
    key: "",
    label: "",
    icon: "",
    osm_query: "",
    google_type: "",
    is_global: true
  });

  // Link Modal States
  const [linkingEvent, setLinkingEvent] = useState<any | null>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsData, filtersData] = await Promise.all([
        api.getEvents(),
        api.getFilters()
      ]);
      setEvents(eventsData);
      setFilters(filtersData);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement des données.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ==========================================
  // EVENT OPERATIONS
  // ==========================================
  const openCreateEventModal = () => {
    setEditingEvent(null);
    setEventForm({ name: "", code: "", description: "", is_active: true });
    setEventModalOpen(true);
  };

  const openEditEventModal = (event: any) => {
    setEditingEvent(event);
    setEventForm({
      name: event.name,
      code: event.code,
      description: event.description || "",
      is_active: event.is_active
    });
    setEventModalOpen(true);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        const updated = await api.updateEvent(editingEvent.id, eventForm);
        showMessage("Événement mis à jour avec succès.");
      } else {
        await api.createEvent(eventForm);
        showMessage("Événement créé avec succès.");
      }
      setEventModalOpen(false);
      fetchData();
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la sauvegarde.", "error");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cet événement partenaire ?")) return;
    try {
      await api.deleteEvent(id);
      showMessage("Événement supprimé.");
      fetchData();
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la suppression.", "error");
    }
  };

  // ==========================================
  // FILTER OPERATIONS
  // ==========================================
  const openCreateFilterModal = () => {
    setEditingFilter(null);
    setFilterForm({ key: "", label: "", icon: "beer", osm_query: "", google_type: "", is_global: true });
    setFilterModalOpen(true);
  };

  const openEditFilterModal = (filter: any) => {
    setEditingFilter(filter);
    setFilterForm({
      key: filter.key,
      label: filter.label,
      icon: filter.icon,
      osm_query: filter.osm_query || "",
      google_type: filter.google_type || "",
      is_global: filter.is_global
    });
    setFilterModalOpen(true);
  };

  const handleFilterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFilter) {
        await api.updateFilter(editingFilter.id, filterForm);
        showMessage("Filtre mis à jour.");
      } else {
        await api.createFilter(filterForm);
        showMessage("Filtre créé.");
      }
      setFilterModalOpen(false);
      fetchData();
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la sauvegarde.", "error");
    }
  };

  const handleDeleteFilter = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce filtre de carte ?")) return;
    try {
      await api.deleteFilter(id);
      showMessage("Filtre supprimé.");
      fetchData();
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la suppression.", "error");
    }
  };

  // ==========================================
  // LINK FILTER TO EVENT
  // ==========================================
  const handleToggleFilterLink = async (filterId: number, isLinked: boolean) => {
    if (!linkingEvent) return;
    try {
      if (isLinked) {
        await api.unlinkFilter(linkingEvent.id, filterId);
        setLinkingEvent((prev: any) => ({
          ...prev,
          filters: prev.filters.filter((f: any) => f.id !== filterId)
        }));
      } else {
        await api.linkFilter(linkingEvent.id, filterId);
        const filterObj = filters.find((f) => f.id === filterId);
        setLinkingEvent((prev: any) => ({
          ...prev,
          filters: [...prev.filters, { id: filterId, key: filterObj.key, label: filterObj.label }]
        }));
      }
      fetchData();
    } catch (err: any) {
      showMessage(err.message || "Erreur d'association de filtre.", "error");
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Toast alert */}
      {message && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl border flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-top duration-300 ${
          message.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-rose-500" />
            Événements & Filtres
          </h1>
          <p className="text-slate-400 mt-1">Configurez les campagnes promotionnelles et personnalisez les filtres OSM.</p>
        </div>

        <button 
          onClick={activeTab === "events" ? openCreateEventModal : openCreateFilterModal}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-500/10"
        >
          <Plus className="w-4.5 h-4.5" />
          {activeTab === "events" ? "Ajouter un événement" : "Créer un filtre"}
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-900 gap-6">
        <button
          onClick={() => setActiveTab("events")}
          className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "events" 
              ? "border-rose-500 text-rose-400" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          🎫 Événements Partenaires ({events.length})
        </button>
        <button
          onClick={() => setActiveTab("filters")}
          className={`pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "filters" 
              ? "border-rose-500 text-rose-400" 
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          🧭 Filtres de Carte ({filters.length})
        </button>
      </div>

      {/* Page Content */}
      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-400 flex gap-3 items-center">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      ) : activeTab === "events" ? (
        /* ========================================================================= */
        /* EVENTS LIST VIEW */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 font-medium bg-slate-900/10 border border-slate-900 rounded-3xl">
              Aucun événement partenaire enregistré.
            </div>
          ) : (
            events.map((event) => (
              <div 
                key={event.id}
                className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-all duration-300 relative shadow-xl"
              >
                {/* Event header card */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CODE: {event.code}</span>
                      <h3 className="text-lg font-black text-white mt-1 tracking-tight">{event.name}</h3>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      event.is_active 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-slate-950 border-slate-900 text-slate-500"
                    }`}>
                      {event.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>

                  <p className="text-slate-400 text-xs mt-3 leading-relaxed min-h-[40px]">
                    {event.description || "Aucune description fournie pour cet événement."}
                  </p>

                  {/* Linked filters details */}
                  <div className="mt-4 pt-4 border-t border-slate-900/80">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filtres de carte associés :</p>
                    {event.filters?.length === 0 ? (
                      <span className="text-[11px] text-slate-600 italic">Aucun filtre spécifique associé</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {event.filters.map((f: any) => (
                          <span key={f.id} className="text-[10px] font-bold bg-slate-950 text-slate-400 border border-slate-900 px-2 py-0.5 rounded-md">
                            {f.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Event action footer */}
                <div className="mt-6 pt-4 border-t border-slate-900/80 flex items-center justify-between">
                  <button
                    onClick={() => setLinkingEvent(event)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Associer filtres
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditEventModal(event)}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* FILTERS LIST VIEW */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filters.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 font-medium bg-slate-900/10 border border-slate-900 rounded-3xl">
              Aucun filtre de carte personnalisé configuré.
            </div>
          ) : (
            filters.map((filter) => (
              <div 
                key={filter.id}
                className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-800 transition-all duration-300 relative shadow-xl"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold rounded-lg text-sm">
                        {filter.icon || "🔍"}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500">KEY: {filter.key}</span>
                        <h3 className="text-base font-extrabold text-white leading-tight mt-0.5">{filter.label}</h3>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      filter.is_global 
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                        : "bg-violet-500/10 border-violet-500/20 text-violet-400"
                    }`}>
                      {filter.is_global ? "Global" : "Événementiel"}
                    </span>
                  </div>

                  {/* OSM Query code preview */}
                  <div className="mt-4 bg-slate-950 rounded-xl p-3 border border-slate-900/80 font-mono text-[10px] text-slate-400 overflow-x-auto max-h-24">
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Code className="w-3 h-3" /> OSM Query
                    </p>
                    {filter.osm_query}
                  </div>
                </div>

                {/* Filter action footer */}
                <div className="mt-6 pt-4 border-t border-slate-900/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {filter.google_type ? `Google: ${filter.google_type}` : "Pas de type Google"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditFilterModal(filter)}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFilter(filter.id)}
                      className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */
      /* EVENT CREATION / EDITION MODAL */
      /* ========================================================================= */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-900 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2.5">
              <Calendar className="w-5.5 h-5.5 text-rose-500" />
              {editingEvent ? "Modifier l'événement" : "Créer un événement partenaire"}
            </h3>

            <form onSubmit={handleEventSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nom de l'événement</label>
                <input 
                  type="text" 
                  required
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="ex: Le Grand Crawl Toulousain"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Code Unique (Entrée App)</label>
                  <input 
                    type="text" 
                    required
                    value={eventForm.code}
                    onChange={(e) => setEventForm({ ...eventForm, code: e.target.value })}
                    placeholder="ex: TOULOUSE2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Statut</label>
                  <select 
                    value={eventForm.is_active ? "true" : "false"}
                    onChange={(e) => setEventForm({ ...eventForm, is_active: e.target.value === "true" })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Décrivez l'ambiance, les règles ou les bars partenaires de la soirée..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-sm font-bold text-white transition-all cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */
      /* FILTER CREATION / EDITION MODAL */
      /* ========================================================================= */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-900 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2.5">
              <Map className="w-5.5 h-5.5 text-rose-500" />
              {editingFilter ? "Modifier le filtre" : "Créer un filtre de carte"}
            </h3>

            <form onSubmit={handleFilterSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Clé Unique (Key)</label>
                  <input 
                    type="text" 
                    required
                    value={filterForm.key}
                    onChange={(e) => setFilterForm({ ...filterForm, key: e.target.value })}
                    placeholder="ex: karaoke"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Libellé (Label)</label>
                  <input 
                    type="text" 
                    required
                    value={filterForm.label}
                    onChange={(e) => setFilterForm({ ...filterForm, label: e.target.value })}
                    placeholder="ex: Karaoké"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Icone (Emoji/Char)</label>
                  <input 
                    type="text" 
                    required
                    value={filterForm.icon}
                    onChange={(e) => setFilterForm({ ...filterForm, icon: e.target.value })}
                    placeholder="ex: 🎤 ou beer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Portée du filtre</label>
                  <select 
                    value={filterForm.is_global ? "true" : "false"}
                    onChange={(e) => setFilterForm({ ...filterForm, is_global: e.target.value === "true" })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="true">Global (Visible par tous)</option>
                    <option value="false">Événementiel (Lié uniquement)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Requête Overpass (OSM Query)</label>
                <textarea 
                  rows={4}
                  required
                  value={filterForm.osm_query}
                  onChange={(e) => setFilterForm({ ...filterForm, osm_query: e.target.value })}
                  placeholder='ex: node["amenity"="bar"]["bar_type"="karaoke"](area.searchArea);'
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type Google Place (Optionnel)</label>
                <input 
                  type="text" 
                  value={filterForm.google_type}
                  onChange={(e) => setFilterForm({ ...filterForm, google_type: e.target.value })}
                  placeholder="ex: bar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-sm font-bold text-white transition-all cursor-pointer"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */
      /* LINKING MODAL */
      /* ========================================================================= */}
      {linkingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-900 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setLinkingEvent(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 hover:text-white"
            >
              x
            </button>

            <h3 className="text-lg font-black text-white mb-2">Associer des filtres</h3>
            <p className="text-xs text-slate-400 mb-6">Événement : <span className="text-rose-400 font-bold">{linkingEvent.name}</span></p>

            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {filters.filter((f) => !f.is_global).length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">Créez d'abord des filtres configurés en tant qu'événementiels.</p>
              ) : (
                filters
                  .filter((f) => !f.is_global)
                  .map((filter) => {
                    const isLinked = linkingEvent.filters?.some((f: any) => f.id === filter.id);
                    return (
                      <div 
                        key={filter.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/50 border border-slate-900"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{filter.label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Clé : {filter.key}</p>
                        </div>

                        <button
                          onClick={() => handleToggleFilterLink(filter.id, isLinked)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isLinked 
                              ? "bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {isLinked ? (
                            <>
                              <Link2Off className="w-3.5 h-3.5" />
                              Désassocier
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5" />
                              Associer
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-900/80 flex justify-end">
              <button
                onClick={() => setLinkingEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-900 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
