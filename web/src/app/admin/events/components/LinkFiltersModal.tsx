import React from "react";
import { X, Link2, Link2Off } from "lucide-react";
import styles from "../events.module.css";

interface LinkFiltersModalProps {
  linkingEvent: any;
  onClose: () => void;
  filters: any[];
  onToggleFilterLink: (filterId: number, isLinked: boolean) => void;
}

export default function LinkFiltersModal({
  linkingEvent,
  onClose,
  filters,
  onToggleFilterLink,
}: LinkFiltersModalProps) {
  if (!linkingEvent) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <button onClick={onClose} className={styles.modalCloseSmall}>
          <X className="w-4.5 h-4.5" />
        </button>

        <h3 className={styles.modalTitle}>Associer des filtres</h3>
        <p className={styles.linkingSubtitle}>
          Événement : <span className="text-rose-400 font-bold">{linkingEvent.name}</span>
        </p>

        <div className={styles.linkingScrollable}>
          {filters.filter((f) => !f.is_global).length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4">
              Créez d'abord des filtres configurés en tant qu'événementiels.
            </p>
          ) : (
            filters
              .filter((f) => !f.is_global)
              .map((filter) => {
                const isLinked = linkingEvent.filters?.some((f: any) => f.id === filter.id);
                return (
                  <div key={filter.id} className={styles.linkingItem}>
                    <div>
                      <p className={styles.linkingItemTitle}>{filter.label}</p>
                      <p className={styles.linkingItemKey}>Clé : {filter.key}</p>
                    </div>

                    <button
                      onClick={() => onToggleFilterLink(filter.id, isLinked)}
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
          <button onClick={onClose} className={styles.btnCancel}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
