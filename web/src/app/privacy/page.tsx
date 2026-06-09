import React from "react";
import Link from "next/link";
import { Beer, ArrowLeft } from "lucide-react";
import styles from "./privacy.module.css";
import Footer from "../../components/Footer";

export default function Privacy() {
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
          Politique de Confidentialité (RGPD)
        </h1>
        
        <p className={styles.date}>Dernière mise à jour : 9 Juin 2026</p>

        <div className={styles.sections}>
          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>1. Collecte des Données</h2>
            <p>
              Dans le cadre de l'utilisation de l'application PubRush, nous collectons les informations nécessaires au bon fonctionnement de nos services :
            </p>
            <ul>
              <li>**Informations d'identification** : Nom d'utilisateur (pseudonyme), adresse email, mot de passe chiffré.</li>
              <li>**Données de localisation** : Localisation GPS (uniquement lorsque l'application est active au cours d'un barathon et avec votre accord préalable, afin de vous situer sur la carte par rapport aux bars et à vos amis).</li>
              <li>**Contenus créés** : Détails des barathons planifiés (noms, dates, étapes de bars), rôles, dépenses partagées saisies par vos soins.</li>
            </ul>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>2. Utilisation des Données</h2>
            <p>
              Vos données personnelles sont utilisées exclusivement pour :
            </p>
            <ul>
              <li>Permettre l'authentification et la gestion sécurisée de votre compte.</li>
              <li>Afficher votre position en temps réel sur la carte interactive lors de vos barathons actifs.</li>
              <li>Calculer et répartir les dépenses partagées de votre groupe.</li>
              <li>Améliorer les performances et l'ergonomie de l'application.</li>
            </ul>
            <p className="mt-4">
              **Aucune donnée de localisation n'est partagée avec des tiers, commercialisée ou stockée de manière persistante après la fin d'un barathon.**
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>3. Sécurité et Stockage des Données</h2>
            <p>
              Toutes les connexions vers notre serveur API sont sécurisées à l'aide du protocole HTTPS/TLS. Les mots de passe sont hachés de manière irréversible à l'aide d'algorithmes sécurisés en base de données. Nous limitons l'accès aux données personnelles aux seuls membres de l'équipe technique chargés du support ou de la modération.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>4. Vos Droits (Droit d'accès et de Suppression de Compte)</h2>
            <p>
              Conformément à la réglementation RGPD, vous disposez d'un droit d'accès, de rectification, de portabilité et d'effacement de vos données personnelles.
            </p>
            <p>
              Vous pouvez supprimer l'intégralité de vos informations personnelles et de votre historique à tout moment en cliquant sur le bouton **Supprimer mon compte** dans l'onglet Profil de l'application mobile. Cette action est immédiate, définitive, et détruit toutes les données liées à votre compte de nos bases de données.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>5. Contact</h2>
            <p>
              Pour toute question relative à notre politique de confidentialité ou pour exercer vos droits, vous pouvez nous écrire par courriel à : **pubrush.app@gmail.com** ou via notre formulaire de contact sur la page d'accueil.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
