import React from "react";
import Link from "next/link";
import { Beer, ArrowLeft } from "lucide-react";

export default function Legal() {
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
          Mentions Légales
        </h1>
        
        <p className="text-sm text-slate-500 mb-8">Dernière mise à jour : 9 Juin 2026</p>

        <div className="space-y-8 text-slate-300 leading-relaxed text-sm sm:text-base">
          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">1. Éditeur de l'Application</h2>
            <p className="mb-2">
              L'application PubRush et le site web associé sont édités par :
            </p>
            <p className="font-semibold text-white">PubRush SAS</p>
            <p className="mt-2">
              Société par actions simplifiée au capital de 1 000 euros.<br />
              Siège social : 12 Rue de la Soif, 31000 Toulouse, France.<br />
              Immatriculée au Registre du Commerce et des Sociétés (RCS) de Toulouse sous le numéro 987 654 321.<br />
              Directeur de la publication : Baptiste Briziou.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">2. Hébergement</h2>
            <p className="mb-2">
              Le site internet et l'infrastructure backend de PubRush sont hébergés par :
            </p>
            <p className="font-semibold text-white">Vercel Inc. / Amazon Web Services (AWS)</p>
            <p className="mt-2">
              Vercel Inc.<br />
              340 S Lemon Ave #1113, Walnut, CA 91789, États-Unis.<br />
              Téléphone : +1 (951) 384-1234
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">3. Contact</h2>
            <p>
              Pour toute question, réclamation ou demande d'information technique, vous pouvez joindre notre service de support par courrier électronique à l'adresse suivante : **pubrush.app@gmail.com**.
            </p>
          </section>

          <section className="bg-slate-900/30 border border-slate-900 p-6 sm:p-8 rounded-2xl">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">4. Propriété Intellectuelle</h2>
            <p>
              La marque PubRush, son logo, le design des interfaces et le code source de l'application mobile et du site web sont protégés par le droit d'auteur et les lois sur la propriété intellectuelle. Toute extraction, reproduction ou diffusion non autorisée donnera lieu à des poursuites judiciaires.
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
