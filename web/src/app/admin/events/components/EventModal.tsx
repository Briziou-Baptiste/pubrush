import React from "react";
import { X, Calendar } from "lucide-react";
import styles from "../events.module.css";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEvent: any;
  eventForm: {
    name: string;
    code: string;
    description: string;
    is_active: boolean;
    start_date: string;
    end_date: string;
    requires_ticket: boolean;
  };
  setEventForm: (form: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EventModal({
  isOpen,
  onClose,
  editingEvent,
  eventForm,
  setEventForm,
  onSubmit,
}: EventModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <button onClick={onClose} className={styles.modalCloseSmall}>
          <X className="w-4.5 h-4.5" />
        </button>

        <h3 className={styles.modalTitle}>
          <Calendar className="w-5.5 h-5.5 text-rose-500" />
          {editingEvent ? "Modifier l'événement" : "Créer un événement partenaire"}
        </h3>

        <form onSubmit={onSubmit} className={styles.form}>
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
            <button type="button" onClick={onClose} className={styles.btnCancel}>
              Annuler
            </button>
            <button type="submit" className={styles.btnSave}>
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
