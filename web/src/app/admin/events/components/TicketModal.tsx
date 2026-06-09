import React from "react";
import { X, Code, Sparkles } from "lucide-react";

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketEvent: any;
  tickets: any[];
  generateCount: number;
  setGenerateCount: (count: number) => void;
  loadingTickets: boolean;
  onGenerateTickets: (e: React.FormEvent) => void;
  onDownloadCSV: () => void;
}

export default function TicketModal({
  isOpen,
  onClose,
  ticketEvent,
  tickets,
  generateCount,
  setGenerateCount,
  loadingTickets,
  onGenerateTickets,
  onDownloadCSV,
}: TicketModalProps) {
  if (!isOpen || !ticketEvent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
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
              <form onSubmit={onGenerateTickets} className="space-y-4">
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
                  onClick={onDownloadCSV}
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
                {tickets.filter((t) => t.is_used).length} utilisés
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
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 hover:border-slate-850 transition-colors"
                    >
                      <div>
                        <span className="font-mono text-xs text-white select-all font-bold">{t.ticket_code}</span>
                        {t.is_used && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Par {t.used_by_username} le{" "}
                            {new Date(t.used_at).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                      <span
                        className={
                          t.is_used
                            ? "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border bg-rose-500/10 border-rose-500/20 text-rose-450"
                            : "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border bg-emerald-500/10 border-emerald-500/20 text-emerald-450"
                        }
                      >
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
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer bg-transparent"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
