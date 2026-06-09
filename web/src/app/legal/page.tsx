import React from "react";
import Link from "next/link";
import { Beer, ArrowLeft } from "lucide-react";
import styles from "./legal.module.css";
import Footer from "../../components/Footer";

export default function Legal() {
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
          Mentions Légales
        </h1>
        
        <p className={styles.date}>Dernière mise à jour : 9 Juin 2026</p>

        <div className={styles.sections}>
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>1. Éditeur de l'Application</h2>
            <p>
              L'application PubRush et le site web associé sont édités par :
            </p>
            <p className="font-semibold text-white">PubRush SAS</p>
            <p>
              Société par actions simplifiée au capital de 1 000 euros.<br />
              Siège social : 12 Rue de la Soif, 31000 Toulouse, France.<br />
              Immatriculée au Registre du Commerce et des Sociétés (RCS) de Toulouse sous le numéro 987 654 321.<br />
              Directeur de la publication : Baptiste Briziou.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>2. Hébergement</h2>
            <p>
              Le site internet et l'infrastructure backend de PubRush sont hébergés par :
            </p>
            <p className="font-semibold text-white">Vercel Inc. / Amazon Web Services (AWS)</p>
            <p>
              Vercel Inc.<br />
              340 S Lemon Ave #1113, Walnut, CA 91789, États-Unis.<br />
              Téléphone : +1 (951) 384-1234
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>3. Contact</h2>
            <p>
              Pour toute question, réclamation ou demande d'information technique, vous pouvez joindre notre service de support par courrier électronique à l'adresse suivante : **pubrush.app@gmail.com**.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>4. Propriété Intellectuelle</h2>
            <p>
              La marque PubRush, son logo, le design des interfaces et le code source de l'application mobile et du site web sont protégés par le droit d'auteur et les lois sur la propriété intellectuelle. Toute extraction, reproduction ou diffusion non autorisée donnera lieu à des poursuites judiciaires.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
