"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  User, 
  Mail, 
  Beer, 
  MapPin, 
  LogOut, 
  Shield, 
  Smartphone,
  Calendar
} from "lucide-react";
import { api } from "../admin/api";
import styles from "./profile.module.css";

export default function UserProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem("pubrush_token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [me, userStats] = await Promise.all([
          api.getMe(),
          api.getMeStats()
        ]);
        setUser(me);
        setStats(userStats);
        setLoading(false);
      } catch (err: any) {
        localStorage.removeItem("pubrush_token");
        router.push("/login");
      }
    };

    fetchUserData();
  }, [router]);

  const handleLogout = () => {
    api.logout();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-violet-600 flex items-center justify-center animate-pulse">
            <Image src="/logo_artistic.png" alt="PubRush Logo" width={48} height={48} className="rounded-xl object-contain" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-400">Chargement de votre profil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Background gradients */}
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      {/* Header */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.brandLink}>
            <Image src="/logo_artistic.png" alt="PubRush Logo" width={32} height={32} className={styles.logo} />
            <span className={styles.brandText}>
              Pub<span className="text-rose-500">Rush</span>
            </span>
          </Link>
          <button 
            onClick={handleLogout}
            className={styles.logoutBtn}
          >
            <LogOut className="w-4.5 h-4.5" />
            Déconnexion
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className={styles.mainContent}>
        <div className={styles.wrapper}>
          
          {/* Welcome Title */}
          <div>
            <span className={styles.tagline}>Mon Compte</span>
            <h1 className={styles.pageTitle}>
              Salut, {user?.username} !
            </h1>
            <p className={styles.pageSubtitle}>Vos informations personnelles et statistiques de barathon.</p>
          </div>

          {/* Admin shortcut block if applicable */}
          {user?.is_admin && (
            <div className={styles.adminAlert}>
              <div className={styles.adminAlertText}>
                <Shield className="w-5 h-5 text-violet-400 shrink-0" />
                <div className={styles.adminAlertMsg}>
                  Vous disposez de privilèges d'administrateur sur PubRush.
                </div>
              </div>
              <Link 
                href="/admin" 
                className={styles.adminLink}
              >
                Accéder à la console d'administration
              </Link>
            </div>
          )}

          <div className={styles.grid}>
            {/* Left: Info Card */}
            <div className={styles.leftCol}>
              <div className={styles.infoCard}>
                <h3 className={styles.infoTitle}>Informations Personnelles</h3>
                
                <div className={styles.infoList}>
                  <div>
                    <span className={styles.infoLabel}>
                      <User className="w-3.5 h-3.5" /> Nom d'utilisateur
                    </span>
                    <p className={styles.infoValue}>{user?.username}</p>
                  </div>

                  <div>
                    <span className={styles.infoLabel}>
                      <Mail className="w-3.5 h-3.5" /> Adresse email
                    </span>
                    <p className={styles.infoValue}>{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Redirect to App card */}
              <div className={styles.appCard}>
                <div className={styles.appHeader}>
                  <div className={styles.appIconBox}>
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={styles.appTitle}>Prêt à lancer un Barathon ?</h3>
                    <p className={styles.appDesc}>
                      L'application web vous permet de gérer vos informations d'identification, mais l'aventure PubRush se vit sur votre smartphone !
                    </p>
                  </div>
                </div>
                
                <a 
                  href="#"
                  className={styles.appLinkBtn}
                >
                  Ouvrir l'application mobile PubRush
                </a>
              </div>
            </div>

            {/* Right: Stats Card */}
            <div className={styles.rightCol}>
              <div className={styles.avatar}>
                {user?.username?.substring(0, 2)}
              </div>
              
              <div className={styles.statsList}>
                <div className={styles.statBlock}>
                  <p className={styles.statValue}>{stats?.barathons_created ?? 0}</p>
                  <p className={styles.statLabel}>
                    <Calendar className="w-3.5 h-3.5" /> Barathons créés
                  </p>
                </div>

                <div className={styles.statBlock}>
                  <p className={styles.statValue}>{stats?.bars_visited ?? 0}</p>
                  <p className={styles.statLabel}>
                    <Beer className="w-3.5 h-3.5" /> Bars visités
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} PubRush. L'abus d'alcool est dangereux pour la santé.</p>
      </footer>
    </div>
  );
}
