import React from "react";
import { X, Map, Code } from "lucide-react";
import styles from "../events.module.css";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingFilter: any;
  filterForm: {
    key: string;
    label: string;
    icon: string;
    osm_query: string;
    google_type: string;
    is_global: boolean;
  };
  setFilterForm: (form: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function FilterModal({
  isOpen,
  onClose,
  editingFilter,
  filterForm,
  setFilterForm,
  onSubmit,
}: FilterModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <button onClick={onClose} className={styles.modalCloseSmall}>
          <X className="w-4.5 h-4.5" />
        </button>

        <h3 className={styles.modalTitle}>
          <Map className="w-5.5 h-5.5 text-rose-500" />
          {editingFilter ? "Modifier le filtre" : "Créer un filtre de carte"}
        </h3>

        <form onSubmit={onSubmit} className={styles.form}>
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
