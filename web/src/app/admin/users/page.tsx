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
  X
} from "lucide-react";
import { api } from "../api";
import styles from "./users.module.css";

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
    <div className={styles.usersWrapper}>
      {/* Toast Alert */}
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
            <Users className={styles.titleIcon} />
            Gestion des Utilisateurs
          </h1>
          <p className={styles.subtitle}>Gérez les privilèges et la modération des comptes PubRush.</p>
        </div>

        {/* Search Input */}
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher par pseudo, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Main Table view */}
      {loading ? (
        <div className={styles.spinnerWrapper}>
          <div className={styles.spinner} />
        </div>
      ) : error ? (
        <div className={styles.errorCard}>
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.scrollWrapper}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadTr}>
                  <th className={styles.th}>ID</th>
                  <th className={styles.th}>Utilisateur</th>
                  <th className={styles.th}>Adresse Email</th>
                  <th className={styles.th}>Rôle</th>
                  <th className={`${styles.th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noResults}>
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className={styles.trHover}>
                      <td className={styles.tdMono}>#{user.id}</td>
                      <td className={styles.tdUser}>
                        <div className={styles.userProfile}>
                          <div className={styles.userAvatar}>
                            {user.username?.substring(0, 2) || "U"}
                          </div>
                          <span className={styles.username}>{user.username}</span>
                        </div>
                      </td>
                      <td className={styles.tdEmail}>{user.email}</td>
                      <td className={styles.tdRole}>
                        {user.is_admin ? (
                          <span className={styles.badgeAdmin}>
                            Administrateur
                          </span>
                        ) : (
                          <span className={styles.badgeMember}>
                            Membre
                          </span>
                        )}
                      </td>
                      <td className={styles.tdActions}>
                        <div className={styles.actionsContainer}>
                          <button
                            onClick={() => handleToggleAdmin(user.id, user.username)}
                            title={user.is_admin ? "Rétrograder membre" : "Promouvoir administrateur"}
                            className={user.is_admin ? styles.btnActionDemote : styles.btnActionPromote}
                          >
                            {user.is_admin ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            title="Supprimer l'utilisateur"
                            className={styles.btnDelete}
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
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className={styles.modalClose}
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className={styles.modalHeader}>
              <Trash2 className="w-6 h-6" />
              <h3 className={styles.modalTitle}>Supprimer l'utilisateur ?</h3>
            </div>

            <p className={styles.modalDesc}>
              Attention : Cette opération est définitive. La suppression détruira toutes les données liées à ce membre (historique de barathons, dépenses, balances, etc.) de manière irréversible.
            </p>

            <div className={styles.modalActions}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className={styles.btnCancel}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className={styles.btnConfirm}
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
