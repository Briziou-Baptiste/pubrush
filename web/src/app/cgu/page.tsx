import React from "react";
import Link from "next/link";
import { Beer, ArrowLeft } from "lucide-react";
import styles from "./cgu.module.css";
import Footer from "../../components/Footer";

export default function CGU() {
  return (
    <div className={styles.pageContainer}>
      {/* Background gradients */}
      <div className={styles.glow} />

      {/* Header */}
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.brandLink}>
            <div className={styles.brandLogo}>
              <Beer className="w-4.5 h-4.5 text-white" />
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

      {/* Content */}
      <main className={styles.mainContent}>
        <h1 className={styles.title}>
          Conditions Générales d'Utilisation (CGU)
        </h1>
        
        <p className={styles.date}>Dernière mise à jour : 9 Juin 2026</p>

        <div className={styles.sections}>
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>1. Présentation de l'Application</h2>
            <p>
              L'application mobile **PubRush** est un outil de planification et d'animation de parcours de bars (ci-après dénommés « Barathons ») développé pour faciliter l'organisation événementielle privée et de loisirs entre amis. Les présentes conditions régissent l'accès et l'utilisation de l'application PubRush et de son site internet associé.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>2. Prévention et Responsabilité relative à la consommation d'alcool</h2>
            <div className={styles.warning}>
              ⚠️ AVERTISSEMENT IMPORTANT : L'abus d'alcool est dangereux pour la santé. À consommer avec modération.
            </div>
            <p>
              PubRush est un outil d'aide à l'organisation de parcours géographiques et de gestion budgétaire partagée. **En aucun cas PubRush n'incite à la consommation d'alcool, de boissons alcoolisées ou à la consommation excessive (« binge drinking »).**
            </p>
            <p>
              Chaque utilisateur est entièrement responsable de sa propre consommation, de son comportement et des conséquences juridiques ou physiques qui en découlent. L'application ne fournit aucun service d'achat de boissons ni de transport.
            </p>
            <p>
              Nous incitons fortement nos utilisateurs à désigner un chauffeur sobre (« Sam »), à utiliser les transports en commun, des services de taxis/VTC, et à respecter les lois en vigueur concernant l'ivresse publique et la sécurité routière.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>3. Accès au service et Comptes</h2>
            <p>
              L'accès à l'application requiert la création d'un compte utilisateur. Vous vous engagez à fournir des informations exactes et à les maintenir à jour. La sécurité de vos identifiants relève de votre entière responsabilité.
            </p>
            <p>
              L'utilisateur doit être âgé d'au moins **18 ans** (ou avoir l'âge légal de consommer de l'alcool dans son pays de résidence) pour utiliser l'application PubRush.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>4. Propriété Intellectuelle</h2>
            <p>
              L'ensemble du contenu de l'application et du site web (textes, graphismes, logos, codes sources, icônes) est la propriété exclusive de PubRush. Toute reproduction ou représentation, intégrale ou partielle, du site ou de l'un de ses éléments, sans autorisation écrite préalable, est strictement interdite.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>5. Résiliation</h2>
            <p>
              PubRush se réserve le droit de suspendre ou de supprimer définitivement le compte de tout utilisateur en cas de violation des présentes CGU ou de comportement inapproprié signalé au sein de l'application (ex: harcèlement, usurpation d'identité, création de contenus illicites).
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>6. Modifications des CGU</h2>
            <p>
              Les présentes conditions d'utilisation peuvent être modifiées à tout moment pour s'adapter aux évolutions techniques ou légales. Les utilisateurs seront informés de toute mise à jour majeure directement au sein de l'application ou sur cette page.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
