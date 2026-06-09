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
  Code,
  X
} from "lucide-react";
import { api } from "../api";
import styles from "./events.module.css";

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
        await api.updateEvent(editingEvent.id, eventForm);
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
    <div className={styles.eventsWrapper}>
      {/* Toast alert */}
      {message && (
        <div className={`${styles.toast} ${
          message.type === "success" 
            ? styles.toastSuccess 
            : styles.toastError
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Calendar className={styles.titleIcon} />
            Événements & Filtres
          </h1>
          <p className={styles.subtitle}>Configurez les campagnes promotionnelles et personnalisez les filtres OSM.</p>
        </div>

        <button 
          onClick={activeTab === "events" ? openCreateEventModal : openCreateFilterModal}
          className={styles.btnAdd}
        >
          <Plus className="w-4.5 h-4.5" />
          {activeTab === "events" ? "Ajouter un événement" : "Créer un filtre"}
        </button>
      </div>

      {/* Tabs Menu */}
      <div className={styles.tabsMenu}>
        <button
          onClick={() => setActiveTab("events")}
          className={activeTab === "events" ? styles.tabBtnActive : styles.tabBtnInactive}
        >
          🎫 Événements Partenaires ({events.length})
        </button>
        <button
          onClick={() => setActiveTab("filters")}
          className={activeTab === "filters" ? styles.tabBtnActive : styles.tabBtnInactive}
        >
          🧭 Filtres de Carte ({filters.length})
        </button>
      </div>

      {/* Page Content */}
      {loading ? (
        <div className={styles.spinnerWrapper}>
          <div className={styles.spinner} />
        </div>
      ) : error ? (
        <div className={styles.errorCard}>
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      ) : activeTab === "events" ? (
        /* ========================================================================= */
        /* EVENTS LIST VIEW */
        /* ========================================================================= */
        <div className={styles.eventsGrid}>
          {events.length === 0 ? (
            <div className={styles.noItems}>
              Aucun événement partenaire enregistré.
            </div>
          ) : (
            events.map((event) => (
              <div 
                key={event.id}
                className={styles.eventCard}
              >
                {/* Event header card */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={styles.codeTag}>CODE: {event.code}</span>
                      <h3 className={styles.eventName}>{event.name}</h3>
                    </div>

                    <span className={event.is_active ? styles.activeBadge : styles.inactiveBadge}>
                      {event.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>

                  <p className={styles.eventDesc}>
                    {event.description || "Aucune description fournie pour cet événement."}
                  </p>

                  {/* Linked filters details */}
                  <div className="mt-4 pt-4 border-t border-slate-900/80">
                    <p className={styles.filtersHeader}>Filtres de carte associés :</p>
                    {event.filters?.length === 0 ? (
                      <span className={styles.filtersEmpty}>Aucun filtre spécifique associé</span>
                    ) : (
                      <div className={styles.filtersPillsList}>
                        {event.filters.map((f: any) => (
                          <span key={f.id} className={styles.filterTag}>
                            {f.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Event action footer */}
                <div className={styles.cardDivider}>
                  <button
                    onClick={() => setLinkingEvent(event)}
                    className={styles.linkFiltersBtn}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Associer filtres
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditEventModal(event)}
                      className={styles.editEventBtn}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className={styles.deleteEventBtn}
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
        <div className={styles.filtersGrid}>
          {filters.length === 0 ? (
            <div className={styles.noItems}>
              Aucun filtre de carte personnalisé configuré.
            </div>
          ) : (
            filters.map((filter) => (
              <div 
                key={filter.id}
                className={styles.eventCard}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={styles.filterIconBox}>
                        {filter.icon || "🔍"}
                      </div>
                      <div>
                        <span className={styles.filterKey}>KEY: {filter.key}</span>
                        <h3 className={styles.filterLabel}>{filter.label}</h3>
                      </div>
                    </div>

                    <span className={filter.is_global ? styles.globalBadge : styles.eventOnlyBadge}>
                      {filter.is_global ? "Global" : "Événementiel"}
                    </span>
                  </div>

                  {/* OSM Query code preview */}
                  <div className={styles.queryPreview}>
                    <p className={styles.queryTag}>
                      <Code className="w-3 h-3" /> OSM Query
                    </p>
                    {filter.osm_query}
                  </div>
                </div>

                {/* Filter action footer */}
                <div className={styles.cardDivider}>
                  <span className={styles.googleType}>
                    {filter.google_type ? `Google: ${filter.google_type}` : "Pas de type Google"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditFilterModal(filter)}
                      className={styles.editEventBtn}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFilter(filter.id)}
                      className={styles.deleteEventBtn}
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

      {/* ========================================================================= 
      /* EVENT CREATION / EDITION MODAL 
      /* ========================================================================= */}
      {eventModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>
              <Calendar className="w-5.5 h-5.5 text-rose-500" />
              {editingEvent ? "Modifier l'événement" : "Créer un événement partenaire"}
            </h3>

            <form onSubmit={handleEventSubmit} className={styles.form}>
              <div>
                <label className={styles.formLabel}>Nom de l'événement</label>
                <input 
                  type="text" 
                  required
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="ex: Le Grand Crawl Toulousain"
                  className={styles.formInput}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={styles.formLabel}>Code Unique (Entrée App)</label>
                  <input 
                    type="text" 
                    required
                    value={eventForm.code}
                    onChange={(e) => setEventForm({ ...eventForm, code: e.target.value })}
                    placeholder="ex: TOULOUSE2026"
                    className={styles.formInput}
                  />
                </div>

                <div>
                  <label className={styles.formLabel}>Statut</label>
                  <select 
                    value={eventForm.is_active ? "true" : "false"}
                    onChange={(e) => setEventForm({ ...eventForm, is_active: e.target.value === "true" })}
                    className={styles.formSelect}
                  >
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={styles.formLabel}>Description</label>
                <textarea 
                  rows={3}
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Décrivez l'ambiance, les règles ou les bars partenaires de la soirée..."
                  className={styles.formTextarea}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className={styles.btnCancel}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={styles.btnSave}
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= 
      /* FILTER CREATION / EDITION MODAL 
      /* ========================================================================= */}
      {filterModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>
              <Map className="w-5.5 h-5.5 text-rose-500" />
              {editingFilter ? "Modifier le filtre" : "Créer un filtre de carte"}
            </h3>

            <form onSubmit={handleFilterSubmit} className={styles.form}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={styles.formLabel}>Clé Unique (Key)</label>
                  <input 
                    type="text" 
                    required
                    value={filterForm.key}
                    onChange={(e) => setFilterForm({ ...filterForm, key: e.target.value })}
                    placeholder="ex: karaoke"
                    className={styles.formInput}
                  />
                </div>

                <div>
                  <label className={styles.formLabel}>Libellé (Label)</label>
                  <input 
                    type="text" 
                    required
                    value={filterForm.label}
                    onChange={(e) => setFilterForm({ ...filterForm, label: e.target.value })}
                    placeholder="ex: Karaoké"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={styles.formLabel}>Icone (Emoji/Char)</label>
                  <input 
                    type="text" 
                    required
                    value={filterForm.icon}
                    onChange={(e) => setFilterForm({ ...filterForm, icon: e.target.value })}
                    placeholder="ex: 🎤 ou beer"
                    className={styles.formInput}
                  />
                </div>

                <div>
                  <label className={styles.formLabel}>Portée du filtre</label>
                  <select 
                    value={filterForm.is_global ? "true" : "false"}
                    onChange={(e) => setFilterForm({ ...filterForm, is_global: e.target.value === "true" })}
                    className={styles.formSelect}
                  >
                    <option value="true">Global (Visible par tous)</option>
                    <option value="false">Événementiel (Lié uniquement)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={styles.formLabel}>Requête Overpass (OSM Query)</label>
                <textarea 
                  rows={4}
                  required
                  value={filterForm.osm_query}
                  onChange={(e) => setFilterForm({ ...filterForm, osm_query: e.target.value })}
                  placeholder='ex: node["amenity"="bar"]["bar_type"="karaoke"](area.searchArea);'
                  className={styles.formTextarea}
                />
              </div>

              <div>
                <label className={styles.formLabel}>Type Google Place (Optionnel)</label>
                <input 
                  type="text" 
                  value={filterForm.google_type}
                  onChange={(e) => setFilterForm({ ...filterForm, google_type: e.target.value })}
                  placeholder="ex: bar"
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className={styles.btnCancel}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={styles.btnSave}
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= 
      /* LINKING MODAL 
      /* ========================================================================= */}
      {linkingEvent && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <button
              onClick={() => setLinkingEvent(null)}
              className={styles.modalCloseSmall}
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <h3 className={styles.modalTitle}>Associer des filtres</h3>
            <p className={styles.linkingSubtitle}>Événement : <span className="text-rose-400 font-bold">{linkingEvent.name}</span></p>

            <div className={styles.linkingScrollable}>
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
                        className={styles.linkingItem}
                      >
                        <div>
                          <p className={styles.linkingItemTitle}>{filter.label}</p>
                          <p className={styles.linkingItemKey}>Clé : {filter.key}</p>
                        </div>

                        <button
                          onClick={() => handleToggleFilterLink(filter.id, isLinked)}
                          className={isLinked ? styles.linkBtnLinked : styles.linkBtnUnlinked}
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
                className={styles.btnCancel}
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
