"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ShieldAlert, ArrowLeft } from "lucide-react";
import { api } from "../api";
import styles from "./adminLogin.module.css";
import Footer from "../../../components/Footer";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already logged in as admin
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      api.getMe()
        .then((user) => {
          if (user.is_admin) {
            router.push("/admin");
          } else {
            localStorage.removeItem("admin_token");
          }
        })
        .catch(() => {
          localStorage.removeItem("admin_token");
        });
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate and retrieve token
      await api.login(email, password);
      
      // 2. Fetch current user to verify is_admin flag
      const user = await api.getMe();
      if (!user.is_admin) {
        api.logout();
        setError("Accès refusé. Vous n'avez pas de droits d'administrateur.");
        setLoading(false);
        return;
      }

      // 3. Redirect to dashboard
      router.push("/admin");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Une erreur s'est produite lors de la connexion.");
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Background neon glows */}
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      {/* Back button */}
      <div className={styles.backWrapper}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft className="w-4 h-4" />
          Retour au site
        </Link>
      </div>

      <div className={styles.contentContainer}>
        <div className={styles.wrapper}>
        {/* Logo and title */}
        <div className={styles.header}>
          <Image src="/logo.png" alt="PubRush Logo" width={56} height={56} className={styles.logo} />
          <h1 className={styles.title}>Console Admin</h1>
          <p className={styles.subtitle}>Espace réservé aux modérateurs de PubRush</p>
        </div>

        {/* Card wrapper */}
        <div className={styles.card}>
          {error && (
            <div className={styles.errorCard}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div>
              <label htmlFor="email" className={styles.label}>
                <Mail className="w-3.5 h-3.5" /> Email Administrateur
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pubrush.app@gmail.com"
                className={styles.input}
              />
            </div>

            <div>
              <label htmlFor="password" className={styles.label}>
                <Lock className="w-3.5 h-3.5" /> Mot de passe
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
