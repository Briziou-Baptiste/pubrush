"use client";

import React, { useEffect, useState } from "react";
import { 
  Users, 
  Search, 
  ShieldAlert, 
  Trash2, 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  X
} from "lucide-react";
import { api } from "../api";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals / Dialog states
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Impossible de charger les utilisateurs.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleAdmin = async (userId: number, currentUsername: string) => {
    try {
      const updatedUser = await api.toggleAdmin(userId);
      setUsers((prev) => 
        prev.map((u) => (u.id === userId ? { ...u, is_admin: updatedUser.is_admin } : u))
      );
      setMessage({ 
        text: `Rôle de ${currentUsername} mis à jour avec succès.`, 
        type: "success" 
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ 
        text: err.message || "Erreur de changement de rôle.", 
        type: "error" 
      });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await api.deleteUser(confirmDeleteId);
      setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteId));
      setMessage({ text: "Utilisateur supprimé avec succès.", type: "success" });
      setConfirmDeleteId(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ 
        text: err.message || "Une erreur s'est produite lors de la suppression.", 
        type: "error" 
      });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.username?.toLowerCase() || "").includes(q) ||
      (u.email?.toLowerCase() || "").includes(q) ||
      String(u.id).includes(q)
    );
  });

  return (
    <div className="space-y-8 relative">
      {/* Toast Alert */}
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
            <Users className="w-8 h-8 text-rose-500" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-slate-400 mt-1">Gérez les privilèges et la modération des comptes PubRush.</p>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par pseudo, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/30 border border-slate-900 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Table view */}
      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-400 flex gap-3 items-center">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      ) : (
        <div className="bg-slate-900/10 border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <th className="px-6 py-4.5">ID</th>
                  <th className="px-6 py-4.5">Utilisateur</th>
                  <th className="px-6 py-4.5">Adresse Email</th>
                  <th className="px-6 py-4.5">Rôle</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/80 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-500">#{user.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold uppercase text-xs">
                            {user.username?.substring(0, 2) || "U"}
                          </div>
                          <span className="font-bold text-white">{user.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-medium">{user.email}</td>
                      <td className="px-6 py-4">
                        {user.is_admin ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wide">
                            Administrateur
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wide">
                            Membre
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAdmin(user.id, user.username)}
                            title={user.is_admin ? "Rétrograder membre" : "Promouvoir administrateur"}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${
                              user.is_admin
                                ? "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                                : "bg-rose-500/5 border-rose-500/10 hover:border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                            }`}
                          >
                            {user.is_admin ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            title="Supprimer l'utilisateur"
                            className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 hover:border-rose-500/20 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-900 rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="absolute top-4 right-4 p-1 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 hover:text-white"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-black text-white">Supprimer l'utilisateur ?</h3>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              Attention : Cette opération est définitive. La suppression détruira toutes les données liées à ce membre (historique de barathons, dépenses, balances, etc.) de manière irréversible.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-sm font-bold text-white transition-all cursor-pointer"
              >
                {deleteLoading ? "Suppression..." : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
