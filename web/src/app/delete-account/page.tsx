"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Trash2, 
  ShieldAlert, 
  CheckCircle2, 
  Mail, 
  Lock, 
  AlertTriangle, 
  ArrowLeft, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  Database, 
  ShieldCheck, 
  Loader2,
  HelpCircle
} from "lucide-react";
import { api } from "../admin/api";
import styles from "./deleteAccount.module.css";
import Footer from "../../components/Footer";

const PRIVACY_EMAILS = "privacy@pubrush.app, pubrush.app@gmail.com";
const MAIL_SUBJECT = "Demande de suppression de compte PubRush";
const MAIL_BODY_TEMPLATE = `Bonjour l'équipe PubRush,

Je souhaite demander la suppression définitive de mon compte PubRush et de l'ensemble de mes données associées, conformément à l'article 17 du RGPD (droit à l'effacement) et aux directives de Google Play.

Informations de mon compte :
- Adresse email associée : [Indiquez votre email ici]
- Nom d'utilisateur / Pseudo (si connu) : [Indiquez votre pseudo ici]
- Précisions (ex: compte invité, mot de passe oublié) : 

Je confirme expressément cette demande de suppression irrévocable.

Cordialement,`;

export default function DeleteAccountPage() {
  const [activeTab, setActiveTab] = useState<"automated" | "manual">("automated");

  // Auth / session states
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [useCustomAccount, setUseCustomAccount] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmedCheck, setConfirmedCheck] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Copy buttons feedback
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("pubrush_token");
    if (token) {
      api.getMe()
        .then((user) => {
          setLoggedInUser(user);
        })
        .catch(() => {
          setLoggedInUser(null);
        });
    }
  }, []);

  const handleAutomatedDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedCheck) return;

    setLoading(true);
    setError(null);

    try {
      if (!loggedInUser || useCustomAccount) {
        if (!email.trim() || !password) {
          throw new Error("Veuillez renseigner votre email et mot de passe.");
        }
        // Authenticate user to verify identity and get valid token
        await api.login(email.trim(), password);
      }

      // Call DELETE /me
      await api.deleteAccount();

      // Clear local session state
      setLoggedInUser(null);
      setIsSuccess(true);
    } catch (err: any) {
      setError(
        err.message || 
        "Une erreur est survenue lors de la suppression. Veuillez vérifier vos identifiants."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyEmails = () => {
    navigator.clipboard.writeText("privacy@pubrush.app, pubrush.app@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(MAIL_BODY_TEMPLATE);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  const mailtoHref = `mailto:privacy@pubrush.app,pubrush.app@gmail.com?subject=${encodeURIComponent(
    MAIL_SUBJECT
  )}&body=${encodeURIComponent(MAIL_BODY_TEMPLATE)}`;

  return (
    <div className={styles.pageContainer}>
      {/* Background neon glows */}
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.brandLink}>
            <div className={styles.brandLogo}>
              <Image 
                src="/logo_artistic.png" 
                alt="PubRush Logo" 
                width={24} 
                height={24} 
                className="rounded object-contain"
              />
            </div>
            <span className={styles.brandText}>
              Pub<span className={styles.brandHighlight}>Rush</span>
            </span>
          </Link>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.badge}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Google Play Policy & RGPD
          </span>
          <h1 className={styles.title}>
            Suppression de Compte & Données
          </h1>
          <p className={styles.subtitle}>
            Conformément aux exigences de la console Google Play et au règlement général sur la 
            protection des données (RGPD Art. 17), vous pouvez demander la suppression définitive 
            de votre compte PubRush et de toutes les données personnelles associées.
          </p>
        </div>

        {/* Overview Box (Google Play / GDPR required details) */}
        <div className={styles.overviewCard}>
          <div className={styles.overviewHeader}>
            <div className={styles.overviewIconBox}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className={styles.overviewTitle}>Politique d'effacement des données PubRush</h2>
              <p className={styles.overviewSubtitle}>
                Transparence complète sur le traitement de vos informations personnelles.
              </p>
            </div>
          </div>

          <div className={styles.overviewGrid}>
            <div className={styles.overviewItem}>
              <span className={styles.overviewItemTitle}>
                <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Données effacées
              </span>
              <p className={styles.overviewItemText}>
                Identifiants (email, pseudo, mot de passe haché), barathons créés, étapes de bars, 
                participations, historique de dépenses et statistiques associées.
              </p>
            </div>

            <div className={styles.overviewItem}>
              <span className={styles.overviewItemTitle}>
                <Clock className="w-3.5 h-3.5 text-violet-400" /> Délais de traitement
              </span>
              <p className={styles.overviewItemText}>
                <strong>Immédiat</strong> par authentification automatisée en ligne. 
                <br />
                <strong>Sous 48h ouvrées</strong> pour les demandes formulées par courrier électronique.
              </p>
            </div>

            <div className={styles.overviewItem}>
              <span className={styles.overviewItemTitle}>
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> Données conservées
              </span>
              <p className={styles.overviewItemText}>
                <strong>Aucune donnée personnelle n'est conservée.</strong> L'ensemble de vos données 
                est détruit de manière irrévocable de nos bases de données.
              </p>
            </div>
          </div>
        </div>

        {/* Success Screen */}
        {isSuccess ? (
          <div className={styles.successCard}>
            <div className={styles.successIconBox}>
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className={styles.successBadge}>
              <Check className="w-3 h-3" /> Suppression confirmée
            </span>
            <h2 className={styles.successTitle}>Votre compte a été supprimé avec succès</h2>
            <p className={styles.successDesc}>
              Votre compte PubRush ainsi que l'intégralité de vos informations personnelles, 
              participations, historiques et barathons ont été définitivement et irréversiblement 
              effacés de nos serveurs de production, conformément au RGPD.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/" className={styles.homeBtn}>
                <ArrowLeft className="w-4 h-4" />
                Retour à l'accueil
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs Selector */}
            <div className={styles.tabList} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "automated"}
                onClick={() => setActiveTab("automated")}
                className={`${styles.tabButton} ${
                  activeTab === "automated" ? styles.tabButtonActive : styles.tabButtonInactive
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Option 1 : Suppression immédiate automatisée
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "manual"}
                onClick={() => setActiveTab("manual")}
                className={`${styles.tabButton} ${
                  activeTab === "manual" ? styles.tabButtonActive : styles.tabButtonInactive
                }`}
              >
                <Mail className="w-4 h-4" />
                Option 2 : Demande manuelle par email
              </button>
            </div>

            {/* TAB 1: AUTOMATED OPTION */}
            {activeTab === "automated" && (
              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelIconBox}>
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={styles.panelTitle}>Suppression instantanée par authentification</h2>
                    <p className={styles.panelDesc}>
                      Confirmez votre identité avec vos identifiants PubRush pour déclencher l'effacement 
                      immédiat et autonome de votre compte.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className={styles.errorAlert}>
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleAutomatedDelete}>
                  {loggedInUser && !useCustomAccount ? (
                    <div className={styles.loggedCard}>
                      <div className={styles.loggedInfo}>
                        <div className={styles.loggedAvatar}>
                          {loggedInUser.username?.substring(0, 2)}
                        </div>
                        <div>
                          <p className={styles.loggedName}>
                            Connecté en tant que @{loggedInUser.username}
                          </p>
                          <p className={styles.loggedEmail}>
                            {loggedInUser.email}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseCustomAccount(true)}
                        className={styles.switchAccountBtn}
                      >
                        Supprimer un autre compte
                      </button>
                    </div>
                  ) : (
                    <>
                      {useCustomAccount && loggedInUser && (
                        <div className="mb-4 text-xs text-slate-400">
                          <button
                            type="button"
                            onClick={() => setUseCustomAccount(false)}
                            className="text-rose-400 hover:underline cursor-pointer bg-transparent border-0"
                          >
                            ← Revenir au compte connecté (@{loggedInUser.username})
                          </button>
                        </div>
                      )}

                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label className={styles.label} htmlFor="email">
                            Adresse email du compte
                          </label>
                          <div className={styles.inputWrapper}>
                            <Mail className={styles.inputIcon} />
                            <input
                              id="email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="votre-email@exemple.com"
                              required
                              className={styles.input}
                            />
                          </div>
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.label} htmlFor="password">
                            Mot de passe du compte
                          </label>
                          <div className={styles.inputWrapper}>
                            <Lock className={styles.inputIcon} />
                            <input
                              id="password"
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••••••"
                              required
                              className={styles.input}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Warning banner */}
                  <div className={styles.warningBanner}>
                    <AlertTriangle className={styles.warningBannerIcon} />
                    <div>
                      <h3 className={styles.warningTitle}>Conséquences de la suppression définitive :</h3>
                      <ul className={styles.warningList}>
                        <li>Toutes vos informations personnelles et identifiants seront détruits sans délai.</li>
                        <li>Vos barathons enregistrés, participations et dépenses de groupe seront effacés.</li>
                        <li>Cette opération est irréversible : aucune restauration ultérieure ne sera possible.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Checkbox confirmation */}
                  <label className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      checked={confirmedCheck}
                      onChange={(e) => setConfirmedCheck(e.target.checked)}
                      className={styles.checkbox}
                      required
                    />
                    <span className={styles.checkboxText}>
                      Je confirme vouloir supprimer définitivement mon compte PubRush et toutes mes données personnelles associées. Je comprends que cette action est immédiate et irréversible.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={!confirmedCheck || loading}
                    className={styles.submitBtn}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Suppression définitive en cours...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Supprimer définitivement mon compte maintenant
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: MANUAL EMAIL OPTION */}
            {activeTab === "manual" && (
              <div className={styles.panelCard}>
                <div className={styles.panelHeader}>
                  <div className={styles.panelIconBox}>
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={styles.panelTitle}>Demande manuelle par courrier électronique</h2>
                    <p className={styles.panelDesc}>
                      Vous avez oublié votre mot de passe, utilisé un compte invité temporaire, ou préférez 
                      l'intervention directe de notre délégué à la protection des données (DPO) ?
                    </p>
                  </div>
                </div>

                <div className={styles.emailSteps}>
                  {/* Step 1 : Addresses */}
                  <div className={styles.emailStepItem}>
                    <div className={styles.emailStepHeader}>
                      <span className={styles.emailStepLabel}>1. Destinataires officiels</span>
                      <button
                        type="button"
                        onClick={handleCopyEmails}
                        className={styles.copyBtn}
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Copié !
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copier les adresses
                          </>
                        )}
                      </button>
                    </div>
                    <p className={styles.emailAddressBadge}>
                      {PRIVACY_EMAILS}
                    </p>
                  </div>

                  {/* Step 2 : Pre-filled template */}
                  <div className={styles.emailStepItem}>
                    <div className={styles.emailStepHeader}>
                      <span className={styles.emailStepLabel}>2. Modèle de message pré-rédigé</span>
                      <button
                        type="button"
                        onClick={handleCopyTemplate}
                        className={styles.copyBtn}
                      >
                        {copiedTemplate ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Copié !
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copier le modèle
                          </>
                        )}
                      </button>
                    </div>
                    <pre className={styles.templateCodeBox}>
                      {MAIL_BODY_TEMPLATE}
                    </pre>
                  </div>

                  {/* Step 3 : Direct action button */}
                  <div className="pt-2">
                    <a
                      href={mailtoHref}
                      className={styles.openMailClientBtn}
                    >
                      <Mail className="w-5 h-5" />
                      Ouvrir mon client de messagerie pré-rempli
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </a>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                  <strong>Traitement et délai :</strong> Votre demande sera prise en compte par notre 
                  équipe sous 48 heures ouvrées. Un courriel de confirmation d'effacement complet vous sera 
                  transmis dès que l'opération aura été exécutée en base de données.
                </div>
              </div>
            )}
          </>
        )}

        {/* FAQ & Policy Notes */}
        <section className={styles.faqSection}>
          <h2 className={styles.faqSectionTitle}>
            <HelpCircle className="w-5 h-5 text-rose-500" />
            Questions fréquentes & informations légales
          </h2>

          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <h3 className={styles.faqTitle}>
                Comment supprimer mon compte depuis l'application mobile ?
              </h3>
              <p className={styles.faqText}>
                Ouvrez l'application PubRush sur votre smartphone iOS ou Android, accédez à l'onglet 
                <strong> Profil</strong>, puis rendez-vous dans la section <strong>Zone de danger</strong> et 
                sélectionnez <strong>Supprimer mon compte</strong>.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqTitle}>
                Qu'advient-il des barathons partagés avec d'autres amis ?
              </h3>
              <p className={styles.faqText}>
                Si vous étiez le seul participant d'un barathon, celui-ci est intégralement détruit. 
                Si d'autres amis participaient à l'événement, votre présence et vos dépenses sont retirées, 
                et la propriété du barathon est réattribuée sans conserver vos données personnelles.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqTitle}>
                Puis-je réactiver mon compte après suppression ?
              </h3>
              <p className={styles.faqText}>
                Non. L'effacement est définitif, immédiat et irréversible. Pour utiliser à nouveau 
                PubRush, il sera nécessaire de créer un tout nouveau compte.
              </p>
            </div>

            <div className={styles.faqCard}>
              <h3 className={styles.faqTitle}>
                Consultez nos engagements de confidentialité
              </h3>
              <p className={styles.faqText}>
                Pour plus d'informations sur vos droits ou notre infrastructure de sécurité, 
                consultez notre <Link href="/privacy" className="text-rose-400 hover:underline">Politique de Confidentialité</Link> ainsi 
                que nos <Link href="/cgu" className="text-rose-400 hover:underline">Conditions Générales d'Utilisation</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
