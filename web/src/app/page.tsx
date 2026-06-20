"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Beer, 
  MapPin, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Mail, 
  MessageSquare, 
  User, 
  Send,
  Calendar,
  Menu,
  X,
  Search,
  UtensilsCrossed,
  ArrowDown
} from "lucide-react";
import styles from "./page.module.css";
import Footer from "../components/Footer";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API request
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setLoading(false);
    setFormSubmitted(true);
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className={styles.pageContainer}>
      {/* Background gradients */}
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      {/* Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.brandLink}>
            <Image 
              src="/logo_artistic.png" 
              alt="PubRush Logo" 
              width={38} 
              height={38} 
              className="rounded-xl object-contain"
            />
            <span className={styles.brandText}>
              Pub<span className={styles.brandHighlight}>Rush</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className={styles.desktopLinks}>
            <a href="#features" className={styles.navLink}>Fonctionnalités</a>
            <a href="#events" className={styles.navLink}>Événements</a>
            <a href="#contact" className={styles.navLink}>Contact</a>
            <Link href="/login" className={styles.navBtnLogin}>
              Connexion
            </Link>
            <a href="#download" className={styles.navBtnDownload}>
              Télécharger l'app
            </a>
          </div>

          {/* Burger Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={styles.burgerBtn}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className={styles.mobileDropdown}>
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className={styles.mobileNavLink}
            >
              Fonctionnalités
            </a>
            <a 
              href="#events" 
              onClick={() => setMobileMenuOpen(false)}
              className={styles.mobileNavLink}
            >
              Événements
            </a>
            <a 
              href="#contact" 
              onClick={() => setMobileMenuOpen(false)}
              className={styles.mobileNavLink}
            >
              Contact
            </a>
            <Link 
              href="/login" 
              onClick={() => setMobileMenuOpen(false)}
              className={styles.mobileNavLink}
            >
              Connexion
            </Link>
            <a 
              href="#download" 
              onClick={() => setMobileMenuOpen(false)}
              className={styles.mobileNavBtnDownload}
            >
              Télécharger l'app
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="hero" className={styles.heroSection}>
        <div className={styles.heroLeft}>
          <div className={styles.heroTag}>
            <Sparkles className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            Planifiez, explorez, partagez
          </div>
          
          <h1 className={styles.heroTitle}>
            Organisez vos <span className={styles.heroTitleGradient}>barathons</span> entre amis.
          </h1>

          <p className={styles.heroDesc}>
            PubRush est un outil pour planifier vos parcours de bars. Créez des parcours personnalisés, découvrez des bars à proximité sur une carte interactive, et gérez vos comptes facilement.
          </p>

          {/* Premium Redesigned Download CTAs */}
          <div id="download" className={styles.downloadContainer}>
            <a 
              href="https://apps.apple.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.downloadBtn}
            >
              <svg className="w-6 h-6 text-slate-100 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.5-.62.72-1.16 1.86-1.02 2.97 1.1.09 2.22-.59 2.95-1.41z"/>
              </svg>
              <div className="text-left">
                <p className={styles.downloadBtnLabel}>Disponible sur</p>
                <p className={styles.downloadBtnValue}>App Store</p>
              </div>
            </a>
            <a 
              href="https://play.google.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.downloadBtnViolet}
            >
              <svg className="w-6 h-6 text-slate-100 fill-current" viewBox="0 0 24 24">
                <path d="M5 3.25c-.28 0-.5.22-.5.5v16.5c0 .28.22.5.5.5.16 0 .3-.07.4-.2l11.45-8.3c.27-.2.27-.6 0-.8L5.4 3.45c-.1-.13-.24-.2-.4-.2zM6 5.5l9.28 6.5L6 18.5V5.5z"/>
              </svg>
              <div className="text-left">
                <p className={styles.downloadBtnLabel}>Disponible sur</p>
                <p className={styles.downloadBtnValue}>Google Play</p>
              </div>
            </a>
          </div>
        </div>

        {/* High-Fidelity Non-deformable Phone Simulator Mockup */}
        <div className={styles.simulatorWrapper}>
          <div className={styles.simulatorGlow} />
          
          {/* Phone Frame - Strict Fixed Dimensions */}
          <div className={styles.simulatorFrame}>
            
            {/* Dynamic Island & Time */}
            <div className={styles.islandTime}>
              <span className={styles.timeText}>09:42</span>
              <div className={styles.island} />
              <div className={styles.statusIcons}>
                <div className={styles.networkIcon}>5G</div>
                <div className={styles.batteryIcon}>
                  <div className={styles.batteryLevel} />
                </div>
              </div>
            </div>
            
            {/* Map Screen Background - Restrict to actual inner dimensions (296x626) */}
            <div className={styles.mapBg}>
              {/* Grid/Street Pattern */}
              <svg className={styles.mapSvg} viewBox="0 0 296 626" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#E2E8F0" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                {/* Styled Roads */}
                <path d="M-20,150 Q100,120 340,160" fill="none" stroke="#FFFFFF" strokeWidth="16" strokeLinecap="round" />
                <path d="M110,-20 L90,660" fill="none" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" />
                <path d="M220,-20 L240,660" fill="none" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" />
                <path d="M-20,380 L340,320" fill="none" stroke="#FFFFFF" strokeWidth="18" strokeLinecap="round" />
                
                {/* Green highlighted route path */}
                <path d="M 108 268 L 132 268 L 132 332 L 157 332" fill="none" stroke="#27AE60" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              
              {/* Search Radius Area Circle */}
              <div className={styles.searchRadius} />

              {/* User location dot */}
              <div className={styles.userDotWrapper}>
                <div className={styles.userDot}>
                  <div className={styles.userDotPing} />
                </div>
              </div>

              {/* Map pins */}
              <div className="absolute top-[180px] left-[60px] z-10">
                <div className={styles.purplePin}>
                  <div className={styles.purplePinDot} />
                </div>
              </div>

              <div className="absolute top-[150px] left-[170px] z-10">
                <div className={styles.purplePin}>
                  <div className={styles.purplePinDot} />
                </div>
              </div>

              <div className="absolute top-[230px] left-[250px] z-10">
                <div className={styles.purplePin}>
                  <div className={styles.purplePinDot} />
                </div>
              </div>

              <div className="absolute top-[260px] left-[210px] z-10">
                <div className={styles.purplePin}>
                  <div className={styles.purplePinDot} />
                </div>
              </div>

              <div className="absolute top-[400px] left-[50px] z-10">
                <div className={styles.purplePin}>
                  <div className={styles.purplePinDot} />
                </div>
              </div>

              <div className="absolute top-[430px] left-[200px] z-10">
                <div className={styles.purplePin}>
                  <div className={styles.purplePinDot} />
                </div>
              </div>

              {/* Red Selected pin */}
              <div className="absolute top-[320px] left-[145px] z-10">
                <div className={styles.redPin}>
                  <div className={styles.redPinDot} />
                </div>
              </div>
            </div>

            {/* Top Floating App Card */}
            <div className={styles.topFloatingCard}>
              <div>
                <h4 className={styles.cardTitle}>PubRush</h4>
                <p className={styles.cardSubtitle}>Nom du barathon : PubRush</p>
                <p className={styles.cardMeta}>Date de début : 09/06/2026 à 09:41</p>
              </div>
              <div className={styles.cardBtn}>
                Retour
              </div>
            </div>

            {/* Floating Search Controls */}
            <div className={styles.searchControls}>
              {/* Search input bar */}
              <div className={styles.searchBar}>
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className={styles.searchText}>Rechercher un lieu (ex: Delirium...)</span>
              </div>
              {/* Category Pills */}
              <div className={styles.pills}>
                <div className={styles.pillActive}>
                  <Beer className="w-3 h-3 text-white" />
                  Bars
                </div>
                <div className={styles.pillInactive}>
                  <UtensilsCrossed className="w-3 h-3 text-slate-500" />
                  Restaurants
                </div>
              </div>
            </div>

            {/* Floating Bottom Card */}
            <div className={styles.bottomFloatingCard}>
              <div>
                <h5 className={styles.floatingSectionHeader}>Lieux sélectionnés</h5>
                <div className={styles.stepCard}>
                  <div>
                    <span className={styles.stepLabel}>Étape 1</span>
                    <p className={styles.stepTitle}>Delirium Café</p>
                    <p className={styles.stepMeta}>Bar • 43.60708 / 1.45129</p>
                  </div>
                  <span className={styles.stepDelete}>Supprimer</span>
                </div>
              </div>

              <div className={styles.stepIndicator}>
                <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                <span className={styles.indicatorText}>Temps estimé : 3 min</span>
              </div>

              <div className={styles.ctaBtn}>
                Créer mon barathon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.featuresSection}>
        <div className="max-w-7xl mx-auto px-6">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTag}>Expérience Inégalée</h2>
            <p className={styles.sectionTitle}>
              Tout ce dont vous avez besoin pour une soirée mémorable
            </p>
            <p className={styles.sectionDesc}>
              Plus besoin d'improviser ou de courir après les comptes de chacun. PubRush regroupe toutes les fonctionnalités clés.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {/* Feature 1: Custom Barathons */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconRose}>
                <Beer className="w-6 h-6" />
              </div>
              <h3 className={styles.featureTitle}>Barathon sur-mesure</h3>
              <p className={styles.featureDesc}>
                Configurez votre parcours, l'heure de départ, le temps par bar et attribuez des rôles originaux à vos amis.
              </p>
            </div>

            {/* Feature 2: Interactive Map */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconViolet}>
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className={styles.featureTitle}>Carte Interactive</h3>
              <p className={styles.featureDesc}>
                Suivez votre groupe en temps réel. Découvrez des bars à proximité et profitez du guidage GPS pour ne perdre personne.
              </p>
            </div>

            {/* Feature 3: Expense Splitting */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconEmerald}>
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className={styles.featureTitle}>Dépenses partagées</h3>
              <p className={styles.featureDesc}>
                Entrez qui a payé la dernière tournée. Notre algorithme calcule les équilibres instantanément pour diviser sans prise de tête.
              </p>
            </div>

            {/* Feature 4: Partner Events */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconPink}>
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className={styles.featureTitle}>Événements & Partenaires</h3>
              <p className={styles.featureDesc}>
                Participez à des événements officiels. Découvrez des bars partenaires et débloquez des réductions ou avantages exclusifs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Events Feature Showcase */}
      <section id="events" className={styles.eventsSection}>
        <div className={styles.eventsSectionGlow} />
        
        <div className={styles.eventsCardWrapper}>
          <div className={styles.eventsLeft}>
            <div className={styles.eventsTag}>
              <Calendar className="w-3.5 h-3.5" />
              Événements Partenaires
            </div>
            <h2 className={styles.eventsTitle}>
              Rejoignez des événements officiels
            </h2>
            <p className={styles.eventsDesc}>
              Explorez le nouvel onglet **Événements** directement dans l'application mobile. Suivez des barathons thématiques organisés dans votre ville, découvrez des partenariats locaux, et cumulez des points ou débloquez des promotions exclusives. 
            </p>
            
            <ul className={styles.eventsList}>
              {[
                "Accès gratuit à des parcours officiels thématisés",
                "Promotions exclusives négociées avec nos bars partenaires",
                "Rencontrez de nouvelles personnes partageant la même ambiance",
                "Pas de code requis, tout est géré directement sur votre app"
              ].map((item, idx) => (
                <li key={idx} className={styles.eventsListItem}>
                  <CheckCircle2 className={styles.eventsListCheck} />
                  <span className={styles.eventsListText}>{item}</span>
                </li>
              ))}
            </ul>

            <div className={styles.eventsCta}>
              <a href="#download" className={styles.eventsCtaBtn}>
                Découvrir sur mobile
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <div className={styles.eventsRight}>
            <div className={styles.eventsPromoCard}>
              <div className={styles.promoHeader}>
                <div>
                  <h3 className={styles.promoTitle}>Événements Actifs</h3>
                  <p className={styles.promoSubtitle}>Découvrez les parcours du moment</p>
                </div>
                <span className={styles.promoLiveBadge}>Live</span>
              </div>

              <div className={styles.promoList}>
                <div className={styles.promoCardActive}>
                  <span className={styles.promoCardTag}>FESTIVAL DE PRINTEMPS</span>
                  <p className={styles.promoCardTitle}>Le Grand Crawl Printanier</p>
                  <p className={styles.promoCardLocation}>
                    <MapPin className="w-3 h-3 text-slate-500" /> Toulouse • 5 bars partenaires
                  </p>
                </div>

                <div className={styles.promoCardInactive}>
                  <span className={styles.promoCardTagInactive}>SOIRÉE ÉTUDIANTE</span>
                  <p className={styles.promoCardTitle}>Le Raid Campus</p>
                  <p className={styles.promoCardLocation}>
                    <MapPin className="w-3 h-3 text-slate-500" /> Paris • 4 bars partenaires
                  </p>
                </div>
              </div>
              
              <div className={styles.promoAlert}>
                <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
                <span className={styles.promoAlertText}>Installez l'application pour scanner les codes et rejoindre un barathon actif.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={styles.contactSection}>
        <div className={styles.contactGlow} />
        
        <div className={styles.contactContainer}>
          <div className={styles.contactGrid}>
            <div className={styles.contactLeft}>
              <h2 className={styles.sectionTag}>Support & Contact</h2>
              <p className={styles.eventsTitle}>
                Une question ? Contactez-nous
              </p>
              <p className={styles.eventsDesc}>
                Vous rencontrez un problème sur l'application mobile, vous êtes gérant d'établissement et souhaitez devenir partenaire, ou vous voulez simplement nous faire un retour ? Remplissez ce formulaire et notre équipe vous répondra sous 24h.
              </p>
              
              <div className={styles.contactInfoList}>
                <div className={styles.contactInfoItem}>
                  <div className={styles.contactIconMail}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={styles.contactLabel}>Email Direct</p>
                    <a href="mailto:pubrush.app@gmail.com" className={styles.contactValueLink}>pubrush.app@gmail.com</a>
                  </div>
                </div>

                <div className={styles.contactInfoItem}>
                  <div className={styles.contactIconMessage}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={styles.contactLabel}>Réseaux Sociaux</p>
                    <p className={styles.contactValue}>@pubrush_app</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.contactRight}>
              {formSubmitted ? (
                <div className={styles.successCard}>
                  <div className={styles.successIcon}>
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className={styles.successTitle}>Message envoyé !</h3>
                  <p className={styles.successDesc}>
                    Merci pour votre message. Notre équipe d'animation et de support reviendra vers vous au plus vite.
                  </p>
                  <button 
                    onClick={() => setFormSubmitted(false)}
                    className={styles.successBtn}
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div>
                    <label htmlFor="name" className={styles.formLabel}>
                      <User className="w-3.5 h-3.5" /> Nom complet
                    </label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name" 
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Jean Dupont"
                      className={styles.formInput}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className={styles.formLabel}>
                      <Mail className="w-3.5 h-3.5" /> Adresse email
                    </label>
                    <input 
                      type="email" 
                      id="email" 
                      name="email" 
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="jean.dupont@email.com"
                      className={styles.formInput}
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className={styles.formLabel}>
                      <MessageSquare className="w-3.5 h-3.5" /> Sujet
                    </label>
                    <input 
                      type="text" 
                      id="subject" 
                      name="subject" 
                      required
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="Demande de partenariat / Support technique"
                      className={styles.formInput}
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className={styles.formLabel}>
                      <MessageSquare className="w-3.5 h-3.5" /> Votre message
                    </label>
                    <textarea 
                      id="message" 
                      name="message" 
                      required
                      rows={4}
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Décrivez votre demande en quelques lignes..."
                      className={styles.formTextarea}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className={styles.formSubmit}
                  >
                    {loading ? (
                      <span className={styles.spinner} />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Shared Legal Footer */}
      <Footer />
    </div>
  );
}
