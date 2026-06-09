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

// Sub-components
import EventModal from "./components/EventModal";
import FilterModal from "./components/FilterModal";
import LinkFiltersModal from "./components/LinkFiltersModal";
import TicketModal from "./components/TicketModal";
import QrCodeModal from "./components/QrCodeModal";
import PartnerSpotsModal from "./components/PartnerSpotsModal";


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
    const eventFilters = event.filters || [];
    const globalFilters = filters.filter((f: any) => f.is_global);
    const defaultSpotType = globalFilters.length > 0 
      ? globalFilters[0].key 
      : (eventFilters.length > 0 ? eventFilters[0].key : "bar");

    setSpotsEvent(event);
    setSpotForm({
      name: "",
      spot_type: defaultSpotType,
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

      const eventFilters = spotsEvent.filters || [];
      const globalFilters = filters.filter((f: any) => f.is_global);
      const defaultSpotType = globalFilters.length > 0 
        ? globalFilters[0].key 
        : (eventFilters.length > 0 ? eventFilters[0].key : "bar");

      setSpotForm({
        name: "",
        spot_type: defaultSpotType,
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

      <EventModal

        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        editingEvent={editingEvent}
        eventForm={eventForm}
        setEventForm={setEventForm}
        onSubmit={handleEventSubmit}
      />

      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        editingFilter={editingFilter}
        filterForm={filterForm}
        setFilterForm={setFilterForm}
        onSubmit={handleFilterSubmit}
      />

      <LinkFiltersModal
        linkingEvent={linkingEvent}
        onClose={() => setLinkingEvent(null)}
        filters={filters}
        onToggleFilterLink={handleToggleFilterLink}
      />

      <TicketModal
        isOpen={ticketModalOpen}
        onClose={() => {
          setTicketModalOpen(false);
          setTicketEvent(null);
          setTickets([]);
        }}
        ticketEvent={ticketEvent}
        tickets={tickets}
        generateCount={generateCount}
        setGenerateCount={setGenerateCount}
        loadingTickets={loadingTickets}
        onGenerateTickets={handleGenerateTickets}
        onDownloadCSV={downloadTicketsCSV}
      />

      <QrCodeModal
        isOpen={qrModalOpen}
        onClose={() => {
          setQrModalOpen(false);
          setQrModalEvent(null);
        }}
        qrModalEvent={qrModalEvent}
      />

      <PartnerSpotsModal
        isOpen={spotsModalOpen}
        onClose={() => {
          setSpotsModalOpen(false);
          setSpotsEvent(null);
          setSpots([]);
        }}
        spotsEvent={spotsEvent}
        filters={filters}
        spots={spots}
        loadingSpots={loadingSpots}
        spotForm={spotForm}
        setSpotForm={setSpotForm}
        onSubmitSpot={handleSpotSubmit}
        onDeleteSpot={handleDeleteSpot}
      />
    </div>
  );
}


