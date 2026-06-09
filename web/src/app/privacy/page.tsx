import React from "react";
import Link from "next/link";
import { Beer, ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <nav className="border-b border-slate-900/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-violet-600 flex items-center justify-center">
              <Beer className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Pub<span className="text-rose-500">Rush</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-8">
          Politique de Confidentialité (RGPD)
        </h1>
        
        <p className="text-sm text-slate-500 mb-8">Dernière mise à jour : 9 Juin 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed text-sm sm:text-base">
          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">1. Collecte des Données</h2>
            <p className="mb-4">
              Dans le cadre de l'utilisation de l'application PubRush, nous collectons les informations nécessaires au bon fonctionnement de nos services :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>**Informations d'identification** : Nom d'utilisateur (pseudonyme), adresse email, mot de passe chiffré.</li>
              <li>**Données de localisation** : Localisation GPS (uniquement lorsque l'application est active au cours d'un barathon et avec votre accord préalable, afin de vous situer sur la carte par rapport aux bars et à vos amis).</li>
              <li>**Contenus créés** : Détails des barathons planifiés (noms, dates, étapes de bars), rôles, dépenses partagées saisies par vos soins.</li>
            </ul>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">2. Utilisation des Données</h2>
            <p className="mb-4">
              Vos données personnelles sont utilisées exclusivement pour :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Permettre l'authentification et la gestion sécurisée de votre compte.</li>
              <li>Afficher votre position en temps réel sur la carte interactive lors de vos barathons actifs.</li>
              <li>Calculer et répartir les dépenses partagées de votre groupe.</li>
              <li>Améliorer les performances et l'ergonomie de l'application.</li>
            </ul>
            <p className="mt-4">
              **Aucune donnée de localisation n'est partagée avec des tiers, commercialisée ou stockée de manière persistante après la fin d'un barathon.**
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">3. Sécurité et Stockage des Données</h2>
            <p>
              Toutes les connexions vers notre serveur API sont sécurisées à l'aide du protocole HTTPS/TLS. Les mots de passe sont hachés de manière irréversible à l'aide d'algorithmes sécurisés en base de données. Nous limitons l'accès aux données personnelles aux seuls membres de l'équipe technique chargés du support ou de la modération.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">4. Vos Droits (Droit d'accès et de Suppression de Compte)</h2>
            <p className="mb-4">
              Conformément à la réglementation RGPD, vous disposez d'un droit d'accès, de rectification, de portabilité et d'effacement de vos données personnelles.
            </p>
            <p>
              Vous pouvez supprimer l'intégralité de vos informations personnelles et de votre historique à tout moment en cliquant sur le bouton **Supprimer mon compte** dans l'onglet Profil de l'application mobile. Cette action est immédiate, définitive, et détruit toutes les données liées à votre compte de nos bases de données.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">5. Contact</h2>
            <p>
              Pour toute question relative à notre politique de confidentialité ou pour exercer vos droits, vous pouvez nous écrire par courriel à : **pubrush.app@gmail.com** ou via notre formulaire de contact sur la page d'accueil.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-12 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} PubRush. L'abus d'alcool est dangereux pour la santé.</p>
      </footer>
    </div>
  );
}
