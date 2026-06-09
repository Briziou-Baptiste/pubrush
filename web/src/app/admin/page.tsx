"use client";

import React, { useEffect, useState } from "react";
import { 
  Users, 
  Beer, 
  MapPin, 
  ShieldAlert,
  ArrowRight,
  Sparkles,
  BarChart3
} from "lucide-react";
import { api } from "./api";
import Link from "next/link";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getStats();
        setStats(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Impossible de charger les statistiques.");
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className={styles.spinnerWrapper}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorWrapper}>
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <span className="font-semibold">{error}</span>
      </div>
    );
  }

  const kpis = [
    {
      label: "Utilisateurs Inscrits",
      value: stats?.total_users ?? 0,
      icon: Users,
      iconClass: `${styles.kpiIconWrapper} ${styles.kpiIconWrapperBlue}`,
      glowClass: `${styles.kpiCard} ${styles.kpiCardGlowBlue}`,
      desc: "Comptes créés sur mobile"
    },
    {
      label: "Barathons Lancés",
      value: stats?.total_barathons ?? 0,
      icon: Beer,
      iconClass: `${styles.kpiIconWrapper} ${styles.kpiIconWrapperRose}`,
      glowClass: `${styles.kpiCard} ${styles.kpiCardGlowRose}`,
      desc: "Parcours planifiés ou terminés"
    },
    {
      label: "Stops Enregistrés",
      value: stats?.total_stops ?? 0,
      icon: MapPin,
      iconClass: `${styles.kpiIconWrapper} ${styles.kpiIconWrapperViolet}`,
      glowClass: `${styles.kpiCard} ${styles.kpiCardGlowViolet}`,
      desc: "Bars visités par nos fêtards"
    }
  ];

  return (
    <div className={styles.dashboard}>
      {/* Welcome Header */}
      <div className={styles.titleWrapper}>
        <h1 className={styles.title}>
          <Sparkles className={styles.titleIcon} />
          Tableau de Bord
        </h1>
        <p className={styles.subtitle}>Aperçu en temps réel de l'activité sur PubRush.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className={styles.kpiGrid}>
        {kpis.map((kpi, idx) => (
          <div 
            key={idx} 
            className={kpi.glowClass}
          >
            <div className={styles.kpiHeader}>
              <div>
                <p className={styles.kpiLabel}>{kpi.label}</p>
                <p className={styles.kpiValue}>{kpi.value.toLocaleString()}</p>
              </div>
              <div className={kpi.iconClass}>
                <kpi.icon className="w-5.5 h-5.5" />
              </div>
            </div>
            <p className={styles.kpiDesc}>{kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Analytics illustration & Actions shortcut */}
      <div className={styles.analyticsGrid}>
        {/* Left Card: Welcome Banner */}
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeGlow} />
          
          <div>
            <span className={styles.welcomeTag}>Console de Contrôle</span>
            <h2 className={styles.welcomeTitle}>
              Gérez les événements et modérez la communauté
            </h2>
            <p className={styles.welcomeDesc}>
              Depuis cet espace, vous pouvez promouvoir des utilisateurs en tant qu'administrateurs, supprimer des comptes hors-normes ou inactifs, et créer des événements officiels pour dynamiser l'application mobile.
            </p>
          </div>

          <div className={styles.welcomeActions}>
            <Link 
              href="/admin/users" 
              className={styles.btnSecondary}
            >
              Modérer les utilisateurs
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link 
              href="/admin/events" 
              className={styles.btnPrimary}
            >
              Créer un Événement
              <Sparkles className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right Card: Health / System Status */}
        <div className={styles.systemCard}>
          <div>
            <h3 className={styles.systemTitle}>
              <BarChart3 className={styles.systemTitleIcon} />
              Statut du Système
            </h3>
            <p className={styles.systemSubtitle}>Santé des services et connexions API</p>
            
            <div className={styles.systemList}>
              <div className={styles.systemItem}>
                <span className={styles.systemItemLabel}>Base de données</span>
                <span className={styles.systemStatus}>
                  <span className={styles.systemStatusDot} />
                  Opérationnel
                </span>
              </div>

              <div className={styles.systemItem}>
                <span className={styles.systemItemLabel}>Serveur API FastAPI</span>
                <span className={styles.systemStatus}>
                  <span className={styles.systemStatusDot} />
                  Opérationnel
                </span>
              </div>

              <div className={styles.systemItem}>
                <span className={styles.systemItemLabel}>Service de géolocalisation</span>
                <span className={styles.systemStatus}>
                  <span className={styles.systemStatusDot} />
                  Actif (OSM)
                </span>
              </div>
            </div>
          </div>

          <div className={styles.versionFooter}>
            <span className={styles.versionText}>Version API : 0.1.0 • Version Web Console : 1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
