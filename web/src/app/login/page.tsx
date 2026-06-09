"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, ShieldAlert, ArrowLeft, User, Sparkles } from "lucide-react";
import { api } from "../admin/api";
import styles from "./login.module.css";
import Footer from "../../components/Footer";

export default function LoginRegister() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  
  // Login Form States
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register Form States
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already logged in and redirect accordingly
  useEffect(() => {
    const token = localStorage.getItem("pubrush_token");
    if (token) {
      api.getMe()
        .then((user) => {
          if (user.is_admin) {
            router.push("/admin");
          } else {
            router.push("/profile");
          }
        })
        .catch(() => {
          localStorage.removeItem("pubrush_token");
        });
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Authenticate
      await api.login(loginEmail, loginPassword);
      
      // 2. Retrieve user info and route
      const user = await api.getMe();
      if (user.is_admin) {
        router.push("/admin");
      } else {
        router.push("/profile");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Erreur de connexion. Veuillez vérifier vos identifiants.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Register account
      await api.register(regUsername, regEmail, regPassword);
      
      // 2. Auto-login after registration
      await api.login(regEmail, regPassword);
      
      // 3. Route to profile
      router.push("/profile");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Erreur lors de l'inscription. L'email ou le nom d'utilisateur est peut-être déjà pris.");
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Background neon glows */}
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      {/* Back button */}
      <div className={styles.backButton}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft className="w-4 h-4" />
          Retour au site
        </Link>
      </div>

      <div className={styles.contentContainer}>
        <div className={styles.wrapper}>
        {/* Logo and title */}
        <div className={styles.header}>
          <Image src="/logo_artistic.png" alt="PubRush Logo" width={56} height={56} className={styles.logo} />
          <h1 className={styles.title}>Espace PubRush</h1>
          <p className={styles.subtitle}>Rejoignez l'aventure barathon</p>
        </div>

        {/* Form Card wrapper */}
        <div className={styles.card}>
          
          {/* Tabs header */}
          <div className={styles.tabs}>
            <button
              onClick={() => {
                setActiveTab("login");
                setError(null);
              }}
              className={`${styles.tabBtn} ${
                activeTab === "login" 
                  ? styles.tabBtnActive 
                  : styles.tabBtnInactive
              }`}
            >
              Se connecter
            </button>
            <button
              onClick={() => {
                setActiveTab("register");
                setError(null);
              }}
              className={`${styles.tabBtn} ${
                activeTab === "register" 
                  ? styles.tabBtnActive 
                  : styles.tabBtnInactive
              }`}
            >
              Créer un compte
            </button>
          </div>

          {error && (
            <div className={styles.errorCard}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "login" ? (
            /* ========================================================================= */
            /* LOGIN FORM */
            /* ========================================================================= */
            <form onSubmit={handleLogin} className={styles.form}>
              <div>
                <label htmlFor="email" className={styles.label}>
                  <Mail className="w-3.5 h-3.5" /> Adresse email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="nom@email.com"
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
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
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
          ) : (
            /* ========================================================================= */
            /* REGISTER FORM */
            /* ========================================================================= */
            <form onSubmit={handleRegister} className={styles.form}>
              <div>
                <label htmlFor="regUsername" className={styles.label}>
                  <User className="w-3.5 h-3.5" /> Nom d'utilisateur
                </label>
                <input
                  type="text"
                  id="regUsername"
                  required
                  minLength={3}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="ex: barathon_fan"
                  className={styles.input}
                />
              </div>

              <div>
                <label htmlFor="regEmail" className={styles.label}>
                  <Mail className="w-3.5 h-3.5" /> Adresse email
                </label>
                <input
                  type="email"
                  id="regEmail"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ex: moncompte@email.com"
                  className={styles.input}
                />
              </div>

              <div>
                <label htmlFor="regPassword" className={styles.label}>
                  <Lock className="w-3.5 h-3.5" /> Mot de passe
                </label>
                <input
                  type="password"
                  id="regPassword"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
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
                    <Sparkles className="w-4 h-4" />
                    Créer mon compte
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
