import React from "react";
import Link from "next/link";
import { Beer, ArrowLeft } from "lucide-react";

export default function CGU() {
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
          Conditions Générales d'Utilisation (CGU)
        </h1>
        
        <p className="text-sm text-slate-500 mb-8">Dernière mise à jour : 9 Juin 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed text-sm sm:text-base">
          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">1. Présentation de l'Application</h2>
            <p>
              L'application mobile **PubRush** est un outil de planification et d'animation de parcours de bars (ci-après dénommés « Barathons ») développé pour faciliter l'organisation événementielle privée et de loisirs entre amis. Les présentes conditions régissent l'accès et l'utilisation de l'application PubRush et de son site internet associé.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">2. Prévention et Responsabilité relative à la consommation d'alcool</h2>
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 mb-4 font-semibold">
              ⚠️ AVERTISSEMENT IMPORTANT : L'abus d'alcool est dangereux pour la santé. À consommer avec modération.
            </div>
            <p className="mb-4">
              PubRush est un outil d'aide à l'organisation de parcours géographiques et de gestion budgétaire partagée. **En aucun cas PubRush n'incite à la consommation d'alcool, de boissons alcoolisées ou à la consommation excessive (« binge drinking »).**
            </p>
            <p className="mb-4">
              Chaque utilisateur est entièrement responsable de sa propre consommation, de son comportement et des conséquences juridiques ou physiques qui en découlent. L'application ne fournit aucun service d'achat de boissons ni de transport.
            </p>
            <p>
              Nous incitons fortement nos utilisateurs à désigner un chauffeur sobre (« Sam »), à utiliser les transports en commun, des services de taxis/VTC, et à respecter les lois en vigueur concernant l'ivresse publique et la sécurité routière.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">3. Accès au service et Comptes</h2>
            <p className="mb-4">
              L'accès à l'application requiert la création d'un compte utilisateur. Vous vous engagez à fournir des informations exactes et à les maintenir à jour. La sécurité de vos identifiants relève de votre entière responsabilité.
            </p>
            <p>
              L'utilisateur doit être âgé d'au moins **18 ans** (ou avoir l'âge légal de consommer de l'alcool dans son pays de résidence) pour utiliser l'application PubRush.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">4. Propriété Intellectuelle</h2>
            <p>
              L'ensemble du contenu de l'application et du site web (textes, graphismes, logos, codes sources, icônes) est la propriété exclusive de PubRush. Toute reproduction ou représentation, intégrale ou partielle, du site ou de l'un de ses éléments, sans autorisation écrite préalable, est strictement interdite.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">5. Résiliation</h2>
            <p>
              PubRush se réserve le droit de suspendre ou de supprimer définitivement le compte de tout utilisateur en cas de violation des présentes CGU ou de comportement inapproprié signalé au sein de l'application (ex: harcèlement, usurpation d'identité, création de contenus illicites).
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">6. Modifications des CGU</h2>
            <p>
              Les présentes conditions d'utilisation peuvent être modifiées à tout moment pour s'adapter aux évolutions techniques ou légales. Les utilisateurs seront informés de toute mise à jour majeure directement au sein de l'application ou sur cette page.
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
