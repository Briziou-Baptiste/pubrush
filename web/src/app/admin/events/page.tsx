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
  X,
  QrCode,
  Ticket,
  MapPin
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
    is_active: true,
    start_date: "",
    end_date: "",
    requires_ticket: false
  });

  // Ticket Modal States
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketEvent, setTicketEvent] = useState<any | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [generateCount, setGenerateCount] = useState<number>(50);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // QR Code Modal States
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalEvent, setQrModalEvent] = useState<any | null>(null);

  // Partner Spots Modal States
  const [spotsModalOpen, setSpotsModalOpen] = useState(false);
  const [spotsEvent, setSpotsEvent] = useState<any | null>(null);
  const [spots, setSpots] = useState<any[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [spotForm, setSpotForm] = useState({
    name: "",
    spot_type: "bar",
    latitude: "",
    longitude: "",
    description: ""
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
    setEventForm({
      name: "",
      code: "",
      description: "",
      is_active: true,
      start_date: "",
      end_date: "",
      requires_ticket: false
    });
    setEventModalOpen(true);
  };

  const openEditEventModal = (event: any) => {
    setEditingEvent(event);
    setEventForm({
      name: event.name,
      code: event.code,
      description: event.description || "",
      is_active: event.is_active,
      start_date: event.start_date ? event.start_date.substring(0, 16) : "",
      end_date: event.end_date ? event.end_date.substring(0, 16) : "",
      requires_ticket: event.requires_ticket || false
    });
    setEventModalOpen(true);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedForm = {
        ...eventForm,
        start_date: eventForm.start_date ? eventForm.start_date : null,
        end_date: eventForm.end_date ? eventForm.end_date : null
      };
      if (editingEvent) {
        await api.updateEvent(editingEvent.id, formattedForm);
        showMessage("Événement mis à jour avec succès.");
      } else {
        await api.createEvent(formattedForm);
        showMessage("Événement créé avec succès.");
      }
      setEventModalOpen(false);
      fetchData();
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la sauvegarde.", "error");
    }
  };

  const openTicketModal = async (event: any) => {
    setTicketEvent(event);
    setTicketModalOpen(true);
    setLoadingTickets(true);
    try {
      const ticketsData = await api.getEventTickets(event.id);
      setTickets(ticketsData);
    } catch (err: any) {
      showMessage(err.message || "Erreur de chargement des tickets.", "error");
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleGenerateTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketEvent) return;
    setLoadingTickets(true);
    try {
      await api.generateEventTickets(ticketEvent.id, generateCount);
      showMessage(`${generateCount} tickets générés avec succès.`);
      const ticketsData = await api.getEventTickets(ticketEvent.id);
      setTickets(ticketsData);
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la génération.", "error");
    } finally {
      setLoadingTickets(false);
    }
  };

  const downloadTicketsCSV = () => {
    if (!ticketEvent || tickets.length === 0) return;
    const headers = "Code,Statut,Utilisé par,Utilisé le\n";
    const rows = tickets.map(t => 
      `"${t.ticket_code}","${t.is_used ? 'Utilisé' : 'Disponible'}","${t.used_by_username || ''}","${t.used_at || ''}"`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_${ticketEvent.code}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const openSpotsModal = async (event: any) => {
    setSpotsEvent(event);
    setSpotForm({
      name: "",
      spot_type: "bar",
      latitude: "",
      longitude: "",
      description: ""
    });
    setSpotsModalOpen(true);
    setLoadingSpots(true);
    try {
      const spotsData = await api.getEventSpots(event.id);
      setSpots(spotsData);
    } catch (err: any) {
      showMessage(err.message || "Erreur de chargement des points partenaires.", "error");
    } finally {
      setLoadingSpots(false);
    }
  };

  const handleSpotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spotsEvent) return;
    
    const latNum = parseFloat(spotForm.latitude);
    const lngNum = parseFloat(spotForm.longitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      showMessage("La latitude doit être comprise entre -90 et 90.", "error");
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      showMessage("La longitude doit être comprise entre -180 et 180.", "error");
      return;
    }

    setLoadingSpots(true);
    try {
      await api.createEventSpot(spotsEvent.id, {
        name: spotForm.name,
        spot_type: spotForm.spot_type,
        latitude: latNum,
        longitude: lngNum,
        description: spotForm.description || undefined
      });
      showMessage("Point partenaire ajouté avec succès.");
      setSpotForm({
        name: "",
        spot_type: "bar",
        latitude: "",
        longitude: "",
        description: ""
      });
      const spotsData = await api.getEventSpots(spotsEvent.id);
      setSpots(spotsData);
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de l'ajout.", "error");
    } finally {
      setLoadingSpots(false);
    }
  };

  const handleDeleteSpot = async (spotId: number) => {
    if (!spotsEvent) return;
    if (!confirm("Voulez-vous vraiment supprimer ce point partenaire ?")) return;

    setLoadingSpots(true);
    try {
      await api.deleteEventSpot(spotsEvent.id, spotId);
      showMessage("Point partenaire supprimé.");
      const spotsData = await api.getEventSpots(spotsEvent.id);
      setSpots(spotsData);
    } catch (err: any) {
      showMessage(err.message || "Erreur lors de la suppression.", "error");
    } finally {
      setLoadingSpots(false);
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
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {event.requires_ticket && (
                          <span className={styles.ticketBadge}>Ticket Requis</span>
                        )}
                      </div>
                      <h3 className={styles.eventName}>{event.name}</h3>
                      {(event.start_date || event.end_date) && (
                        <p className={styles.eventDates}>
                          <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                          {event.start_date ? new Date(event.start_date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Début indéfini"}
                          {" au "}
                          {event.end_date ? new Date(event.end_date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Fin indéfinie"}
                        </p>
                      )}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLinkingEvent(event)}
                      className={styles.linkFiltersBtn}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Associer filtres
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {event.requires_ticket && (
                      <button
                        onClick={() => openTicketModal(event)}
                        className={styles.actionBtn}
                        title="Gérer les tickets"
                      >
                        <Ticket className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => openSpotsModal(event)}
                      className={styles.actionBtn}
                      title="Gérer les points partenaires"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setQrModalEvent(event);
                        setQrModalOpen(true);
                      }}
                      className={styles.actionBtn}
                      title="Afficher le QR Code de l'événement"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>


                    <button
                      onClick={() => openEditEventModal(event)}
                      className={styles.actionBtn}
                      title="Modifier l'événement"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className={styles.deleteEventBtn}
                      title="Supprimer l'événement"
                    >
                      <Trash2 className="w-4 h-4" />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={styles.formLabel}>Date de début</label>
                  <input 
                    type="datetime-local" 
                    value={eventForm.start_date || ""}
                    onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div>
                  <label className={styles.formLabel}>Date de fin</label>
                  <input 
                    type="datetime-local" 
                    value={eventForm.end_date || ""}
                    onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 py-1.5">
                <input 
                  type="checkbox" 
                  id="requires_ticket"
                  checked={eventForm.requires_ticket}
                  onChange={(e) => setEventForm({ ...eventForm, requires_ticket: e.target.checked })}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <label htmlFor="requires_ticket" className="text-xs font-bold text-slate-300 cursor-pointer uppercase tracking-wider">
                  Accès restreint par ticket payant (QR Code requis)
                </label>
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

      {/* ========================================================================= 
      /* TICKET MANAGER MODAL 
      /* ========================================================================= */}
      {ticketModalOpen && ticketEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setTicketModalOpen(false);
                setTicketEvent(null);
                setTickets([]);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2.5">
              <Code className="w-5.5 h-5.5 text-rose-500" />
              Gestion des Tickets d'Accès
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Événement : <span className="text-rose-400 font-bold">{ticketEvent.name}</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden min-h-0 flex-grow">
              {/* Left Column: Generate Tickets */}
              <div className="flex flex-col justify-between py-1">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Générer de nouveaux codes</h4>
                  <form onSubmit={handleGenerateTickets} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nombre de tickets</label>
                      <input 
                        type="number"
                        min={1}
                        max={1000}
                        value={generateCount}
                        onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingTickets}
                      className="w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 disabled:opacity-50 text-sm font-bold text-white transition-all cursor-pointer border-none shadow-lg shadow-rose-500/10"
                    >
                      {loadingTickets ? "Génération..." : "Générer les codes"}
                    </button>
                  </form>
                </div>

                {tickets.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Actions globales</h4>
                    <button
                      onClick={downloadTicketsCSV}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-sm font-bold text-white transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Télécharger (CSV)
                    </button>
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                      Le fichier CSV contient tous les codes de tickets. Utilisez-le pour imprimer des planches de QR Codes pour votre partenaire.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Tickets List */}
              <div className="flex flex-col overflow-hidden py-1">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Liste des codes ({tickets.length})</h4>
                  <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-bold">
                    {tickets.filter(t => t.is_used).length} utilisés
                  </span>
                </div>

                <div className="space-y-2 max-h-[40vh] md:max-h-[50vh] overflow-y-auto pr-1">
                  {loadingTickets && tickets.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Chargement...</p>
                  ) : tickets.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Aucun ticket généré pour cet événement.</p>
                  ) : (
                    <div className="space-y-2">
                      {tickets.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 hover:border-slate-850 transition-colors">
                          <div>
                            <span className="font-mono text-xs text-white select-all font-bold">{t.ticket_code}</span>
                            {t.is_used && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Par {t.used_by_username} le {new Date(t.used_at).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <span className={t.is_used ? "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border bg-rose-500/10 border-rose-500/20 text-rose-400" : "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}>
                            {t.is_used ? "Utilisé" : "Disponible"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => {
                  setTicketModalOpen(false);
                  setTicketEvent(null);
                  setTickets([]);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer bg-transparent"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= 
      /* QR CODE MODAL 
      /* ========================================================================= */}
      {qrModalOpen && qrModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setQrModalOpen(false);
                setQrModalEvent(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2.5">
              <QrCode className="w-5.5 h-5.5 text-rose-500" />
              QR Code de l'Événement
            </h3>
            
            <div className="flex flex-col items-center justify-center py-6 bg-slate-950 rounded-2xl border border-slate-900">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrModalEvent.code)}&color=0-0-0&bgcolor=255-255-255`} 
                alt={`QR Code for ${qrModalEvent.code}`}
                className="w-48 h-48 rounded-xl border-4 border-white mb-2"
              />
              <span className="mt-3 font-mono text-sm font-bold text-white tracking-widest uppercase">
                {qrModalEvent.code}
              </span>
              <span className="text-xs text-slate-500 mt-1 font-bold">
                {qrModalEvent.name}
              </span>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => {
                  setQrModalOpen(false);
                  setQrModalEvent(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer bg-transparent"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= 
      /* PARTNER SPOTS MANAGER MODAL 
      /* ========================================================================= */}
      {spotsModalOpen && spotsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => {
                setSpotsModalOpen(false);
                setSpotsEvent(null);
                setSpots([]);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden min-h-0 flex-grow">
              {/* Left Column: Add Spot Form */}
              <div className="flex flex-col justify-between py-1 overflow-y-auto pr-1">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ajouter un point sur la carte</h4>
                  <form onSubmit={handleSpotSubmit} className="space-y-4">
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

                    <div className="grid grid-cols-1 gap-4">
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
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description / Avantages</label>
                      <textarea 
                        rows={3}
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
              </div>

              {/* Right Column: Spots List */}
              <div className="flex flex-col overflow-hidden py-1">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Points enregistrés ({spots.length})</h4>
                </div>

                <div className="space-y-2 overflow-y-auto pr-1 flex-grow">
                  {loadingSpots && spots.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Chargement des points...</p>
                  ) : spots.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Aucun point d'intérêt enregistré pour cet événement.</p>
                  ) : (
                    <div className="space-y-2">
                      {spots.map((spot) => (
                        <div key={spot.id} className="flex items-start justify-between p-3.5 rounded-xl bg-slate-950/50 border border-slate-850 hover:border-slate-800 transition-colors">
                          <div className="space-y-1 flex-grow">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{spot.name}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                spot.spot_type === 'bar' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                spot.spot_type === 'security' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                spot.spot_type === 'water' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                                spot.spot_type === 'first_aid' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                'bg-slate-800 border-slate-700 text-slate-400'
                              }`}>
                                {spot.spot_type === 'bar' ? '🍻 Bar' :
                                 spot.spot_type === 'security' ? '🛡️ Sécurité' :
                                 spot.spot_type === 'water' ? '💧 Eau' :
                                 spot.spot_type === 'first_aid' ? '🏥 Secours' :
                                 '📍 Autre'}
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
                            onClick={() => handleDeleteSpot(spot.id)}
                            className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer shrink-0 ml-2"
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
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => {
                  setSpotsModalOpen(false);
                  setSpotsEvent(null);
                  setSpots([]);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer bg-transparent"
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

