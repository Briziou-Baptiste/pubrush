"use client";

import React, { useEffect, useState } from "react";
import { 
  Users, 
  Beer, 
  MapPin, 
  TrendingUp, 
  ShieldAlert,
  ArrowRight,
  Sparkles,
  BarChart3
} from "lucide-react";
import { api } from "./api";
import Link from "next/link";

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
      <div className="h-96 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-400 flex gap-3 items-center">
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
      color: "from-blue-500 to-indigo-600",
      glow: "shadow-blue-500/10",
      desc: "Comptes créés sur mobile"
    },
    {
      label: "Barathons Lancés",
      value: stats?.total_barathons ?? 0,
      icon: Beer,
      color: "from-rose-500 to-pink-600",
      glow: "shadow-rose-500/10",
      desc: "Parcours planifiés ou terminés"
    },
    {
      label: "Stops Enregistrés",
      value: stats?.total_stops ?? 0,
      icon: MapPin,
      color: "from-violet-500 to-fuchsia-600",
      glow: "shadow-violet-500/10",
      desc: "Bars visités par nos fêtards"
    }
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-rose-500" />
          Tableau de Bord
        </h1>
        <p className="text-slate-400 mt-1">Aperçu en temps réel de l'activité sur PubRush.</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpis.map((kpi, idx) => (
          <div 
            key={idx} 
            className={`bg-slate-900/30 border border-slate-900 p-6 rounded-3xl backdrop-blur-sm relative group hover:border-slate-800 transition-all duration-300 shadow-xl ${kpi.glow}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                <p className="text-4xl font-black text-white mt-3 tracking-tight">{kpi.value.toLocaleString()}</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-lg`}>
                <kpi.icon className="w-5.5 h-5.5" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-normal font-medium">{kpi.desc}</p>
          </div>
        ))}
      </div>

      {/* Analytics illustration & Actions shortcut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Welcome Banner */}
        <div className="p-8 sm:p-10 rounded-3xl border border-slate-900 bg-gradient-to-br from-rose-500/10 to-violet-600/5 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div>
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">Console de Contrôle</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-6 leading-normal">
              Gérez les événements et modérez la communauté
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-md">
              Depuis cet espace, vous pouvez promouvoir des utilisateurs en tant qu'administrateurs, supprimer des comptes hors-normes ou inactifs, et créer des événements officiels pour dynamiser l'application mobile.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 mt-8">
            <Link 
              href="/admin/users" 
              className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all"
            >
              Modérer les utilisateurs
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link 
              href="/admin/events" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all"
            >
              Créer un Événement
              <Sparkles className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Right Card: Health / System Status */}
        <div className="p-8 rounded-3xl border border-slate-900 bg-slate-900/20 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-rose-500" />
              Statut du Système
            </h3>
            <p className="text-slate-400 text-xs mt-1">Santé des services et connexions API</p>
            
            <div className="space-y-4 mt-6">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-sm font-semibold text-slate-300">Base de données</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  Opérationnel
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-sm font-semibold text-slate-300">Serveur API FastAPI</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  Opérationnel
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-900">
                <span className="text-sm font-semibold text-slate-300">Service de géolocalisation</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  Actif (OSM)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center sm:text-left">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Version API : 0.1.0 • Version Web Console : 1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
