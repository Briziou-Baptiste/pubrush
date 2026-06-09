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
  ShieldAlert,
  Search,
  UtensilsCrossed,
  ArrowDown
} from "lucide-react";

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white overflow-x-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[800px] right-1/4 w-[450px] h-[450px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-900/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/logo_artistic.png" 
              alt="PubRush Logo" 
              width={38} 
              height={38} 
              className="rounded-xl object-contain"
            />
            <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Pub<span className="text-rose-500">Rush</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#events" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Événements</a>
            <a href="#contact" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">Contact</a>
            <Link href="/login" className="text-sm font-semibold px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all">
              Connexion
            </Link>
            <a 
              href="#download" 
              className="text-sm font-bold bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-rose-500/15"
            >
              Télécharger l'app
            </a>
          </div>

          {/* Burger Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-900 bg-slate-950 px-6 py-6 flex flex-col gap-4">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium py-2 text-slate-300 hover:text-white"
            >
              Fonctionnalités
            </a>
            <a 
              href="#events" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium py-2 text-slate-300 hover:text-white"
            >
              Événements
            </a>
            <a 
              href="#contact" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium py-2 text-slate-300 hover:text-white"
            >
              Contact
            </a>
            <Link 
              href="/login" 
              onClick={() => setMobileMenuOpen(false)}
              className="text-lg font-medium py-2 text-slate-300 hover:text-white"
            >
              Connexion
            </Link>
            <a 
              href="#download" 
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center font-bold bg-gradient-to-r from-rose-500 to-violet-600 py-3.5 rounded-xl mt-2 block"
            >
              Télécharger l'app
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="hero" className="max-w-7xl mx-auto px-6 pt-12 pb-24 md:py-32 flex flex-col lg:flex-row items-center justify-between gap-16">
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold tracking-wide mb-6">
            <Sparkles className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            Planifiez, explorez, partagez
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight max-w-2xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Organisez vos <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">barathons</span> entre amis.
          </h1>

          <p className="mt-6 text-lg md:text-xl text-slate-400 leading-relaxed max-w-xl">
            PubRush est un outil pour planifier vos parcours de bars. Créez des parcours personnalisés, découvrez des bars à proximité sur une carte interactive, et gérez vos comptes facilement.
          </p>

          {/* Premium Redesigned Download CTAs */}
          <div id="download" className="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start w-full">
            <a 
              href="https://apps.apple.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 hover:border-rose-500/30 hover:bg-slate-900 hover:shadow-lg hover:shadow-rose-500/5 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto"
            >
              <svg className="w-6 h-6 text-slate-100 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.5-.62.72-1.16 1.86-1.02 2.97 1.1.09 2.22-.59 2.95-1.41z"/>
              </svg>
              <div className="text-left">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Disponible sur</p>
                <p className="text-base font-black text-white mt-1.5 leading-none tracking-tight">App Store</p>
              </div>
            </a>
            <a 
              href="https://play.google.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 hover:border-violet-500/30 hover:bg-slate-900 hover:shadow-lg hover:shadow-violet-500/5 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto"
            >
              <svg className="w-6 h-6 text-slate-100 fill-current" viewBox="0 0 24 24">
                <path d="M5 3.25c-.28 0-.5.22-.5.5v16.5c0 .28.22.5.5.5.16 0 .3-.07.4-.2l11.45-8.3c.27-.2.27-.6 0-.8L5.4 3.45c-.1-.13-.24-.2-.4-.2zM6 5.5l9.28 6.5L6 18.5V5.5z"/>
              </svg>
              <div className="text-left">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Disponible sur</p>
                <p className="text-base font-black text-white mt-1.5 leading-none tracking-tight">Google Play</p>
              </div>
            </a>
          </div>
        </div>

        {/* High-Fidelity Non-deformable Phone Simulator Mockup */}
        <div className="w-[320px] h-[650px] shrink-0 flex-none relative mx-auto lg:mx-0">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-violet-600/20 rounded-[3rem] blur-3xl opacity-60 pointer-events-none" />
          
          {/* Phone Frame - Strict Fixed Dimensions */}
          <div className="absolute inset-0 border-slate-900 bg-slate-900 border-[12px] rounded-[3rem] shadow-2xl overflow-hidden select-none">
            
            {/* Dynamic Island & Time */}
            <div className="absolute top-3 left-0 right-0 z-30 flex items-center justify-between px-6">
              <span className="text-[10px] text-slate-900 font-bold">09:42</span>
              <div className="w-20 h-4.5 bg-black rounded-full" />
              <div className="flex gap-1 items-center">
                <div className="w-2.5 h-2.5 bg-slate-900 rounded-full flex items-center justify-center text-[7px] text-white font-bold">5G</div>
                <div className="w-4 h-2 border border-slate-900 rounded-[3px] p-0.5 flex items-center">
                  <div className="w-2 h-full bg-slate-900 rounded-[1px]" />
                </div>
              </div>
            </div>
            
            {/* Map Screen Background - Restrict to actual inner dimensions (296x626) */}
            <div className="absolute inset-0 bg-[#F4F6FA] z-0 overflow-hidden">
              {/* Grid/Street Pattern */}
              <svg className="absolute inset-0 w-[296px] h-[626px] opacity-75 pointer-events-none" viewBox="0 0 296 626" xmlns="http://www.w3.org/2000/svg">
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
                
                {/* Green highlighted route path - perfectly matching user dot (108, 268) and red pin (157, 332) */}
                <path d="M 108 268 L 132 268 L 132 332 L 157 332" fill="none" stroke="#27AE60" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              
              {/* Search Radius Area Circle - Centered relative to inner content */}
              <div className="absolute top-[300px] left-[148px] -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-blue-500/25 bg-blue-500/[0.03] pointer-events-none" />

              {/* User location dot (centered at x=108, y=268) */}
              <div className="absolute top-[260px] left-[100px] z-10">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                </div>
              </div>

              {/* Map pins (Purple = unselected, Red = selected) */}
              <div className="absolute top-[180px] left-[60px] z-10">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              <div className="absolute top-[150px] left-[170px] z-10">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              <div className="absolute top-[230px] left-[250px] z-10">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              <div className="absolute top-[260px] left-[210px] z-10">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              <div className="absolute top-[400px] left-[50px] z-10">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              <div className="absolute top-[430px] left-[200px] z-10">
                <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>

              {/* Red Selected pin (centered at x=157, y=332) */}
              <div className="absolute top-[320px] left-[145px] z-10">
                <div className="w-6 h-6 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
            </div>

            {/* Top Floating App Card */}
            <div className="absolute top-12 left-3.5 right-3.5 bg-white border border-slate-100 p-3.5 rounded-2xl shadow-md z-20 flex justify-between items-center text-slate-800">
              <div>
                <h4 className="text-sm font-extrabold tracking-tight">PubRush</h4>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Nom du barathon : Test</p>
                <p className="text-[9px] text-slate-400 font-medium">Date de début : 09/06/2026 à 09:41</p>
              </div>
              <div className="bg-black text-white text-[10px] font-bold px-3.5 py-1.5 rounded-xl cursor-pointer">
                Retour
              </div>
            </div>

            {/* Floating Search Controls */}
            <div className="absolute top-[230px] left-3.5 right-3.5 z-20 space-y-2.5">
              {/* Search input bar */}
              <div className="bg-white border border-slate-100 p-2.5 rounded-2xl shadow-sm flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-400 font-medium">Rechercher un lieu (ex: Delirium...)</span>
              </div>
              {/* Category Pills */}
              <div className="flex gap-2">
                <div className="bg-blue-600 text-white px-3.5 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 text-[9px] font-bold">
                  <Beer className="w-3 h-3 text-white" />
                  Bars
                </div>
                <div className="bg-slate-100 text-slate-700 border border-slate-200/50 px-3.5 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 text-[9px] font-semibold">
                  <UtensilsCrossed className="w-3 h-3 text-slate-500" />
                  Restaurants
                </div>
              </div>
            </div>

            {/* Floating Bottom Card */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 rounded-t-[2rem] shadow-[0_-8px_24px_rgba(0,0,0,0.06)] z-20 text-slate-800 space-y-3">
              <div>
                <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lieux sélectionnés</h5>
                <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-rose-500">Étape 1</span>
                    <p className="text-xs font-black text-slate-800">Delirium Café</p>
                    <p className="text-[9px] text-slate-400 font-medium">Bar • 43.60708 / 1.45129</p>
                  </div>
                  <span className="text-[9px] font-extrabold text-red-500 bg-rose-500/5 px-2.5 py-1 rounded-lg">Supprimer</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-emerald-600">Temps estimé : 3 min</span>
              </div>

              <div className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-3.5 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10 cursor-pointer">
                Créer mon barathon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 border-y border-slate-900 bg-slate-950/30 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-xs uppercase font-extrabold text-rose-500 tracking-widest mb-3">Expérience Inégalée</h2>
            <p className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Tout ce dont vous avez besoin pour une soirée mémorable
            </p>
            <p className="mt-4 text-base text-slate-400">
              Plus besoin d'improviser ou de courir après les comptes de chacun. PubRush regroupe toutes les fonctionnalités clés.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1: Custom Barathons */}
            <div className="p-8 rounded-3xl border border-slate-900 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-800 transition-all group hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Beer className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Barathon sur-mesure</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Configurez votre parcours, l'heure de départ, le temps par bar et attribuez des rôles originaux à vos amis.
              </p>
            </div>

            {/* Feature 2: Interactive Map */}
            <div className="p-8 rounded-3xl border border-slate-900 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-800 transition-all group hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Carte Interactive</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Suivez votre groupe en temps réel. Découvrez des bars à proximité et profitez du guidage GPS pour ne perdre personne.
              </p>
            </div>

            {/* Feature 3: Expense Splitting */}
            <div className="p-8 rounded-3xl border border-slate-900 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-800 transition-all group hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Dépenses partagées</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Entrez qui a payé la dernière tournée. Notre algorithme calcule les équilibres instantanément pour diviser sans prise de tête.
              </p>
            </div>

            {/* Feature 4: Partner Events */}
            <div className="p-8 rounded-3xl border border-slate-900 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-800 transition-all group hover:-translate-y-1 duration-300">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Événements & Partenaires</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Participez à des événements officiels. Découvrez des bars partenaires et débloquez des réductions ou avantages exclusifs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Events Feature Showcase */}
      <section id="events" className="py-24 max-w-7xl mx-auto px-6 relative">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="rounded-[40px] border border-slate-900 bg-slate-900/30 p-8 sm:p-16 flex flex-col lg:flex-row items-center gap-16 overflow-hidden">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider mb-6">
              <Calendar className="w-3.5 h-3.5" />
              Événements Partenaires
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Rejoignez des événements officiels
            </h2>
            <p className="mt-6 text-slate-400 leading-relaxed">
              Explorez le nouvel onglet **Événements** directement dans l'application mobile. Suivez des barathons thématiques organisés dans votre ville, découvrez des partenariats locaux, et cumulez des points ou débloquez des promotions exclusives. 
            </p>
            
            <ul className="mt-8 space-y-4">
              {[
                "Accès gratuit à des parcours officiels thématisés",
                "Promotions exclusives négociées avec nos bars partenaires",
                "Rencontrez de nouvelles personnes partageant la même ambiance",
                "Pas de code requis, tout est géré directement sur votre app"
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-slate-300 font-medium">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <a 
                href="#download"
                className="inline-flex items-center gap-2 font-bold bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white px-6 py-3 rounded-xl transition-all"
              >
                Découvrir sur mobile
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <div className="flex-1 w-full flex items-center justify-center max-w-sm lg:max-w-md bg-gradient-to-br from-rose-500/10 to-violet-500/5 p-8 rounded-3xl border border-slate-900 relative">
            <div className="w-full bg-slate-950/80 rounded-2xl border border-slate-800 p-6 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h3 className="font-extrabold text-white text-base">Événements Actifs</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Découvrez les parcours du moment</p>
                </div>
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Live</span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-1">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">FESTIVAL DE PRINTEMPS</span>
                  <p className="text-sm font-extrabold text-white">Le Grand Crawl Printanier</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" /> Toulouse • 5 bars partenaires
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-900 flex flex-col gap-1 opacity-70">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">SOIRÉE ÉTUDIANTE</span>
                  <p className="text-sm font-extrabold text-white">Le Raid Campus</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" /> Paris • 4 bars partenaires
                  </p>
                </div>
              </div>
              
              <div className="mt-5 p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px] text-rose-300 leading-normal">Installez l'application pour scanner les codes et rejoindre un barathon actif.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-slate-950 border-t border-slate-900 relative">
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-rose-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-xs uppercase font-extrabold text-rose-500 tracking-widest mb-3">Support & Contact</h2>
              <p className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Une question ? Contactez-nous
              </p>
              <p className="mt-4 text-slate-400">
                Vous rencontrez un problème sur l'application mobile, vous êtes gérant d'établissement et souhaitez devenir partenaire, ou vous voulez simplement nous faire un retour ? Remplissez ce formulaire et notre équipe vous répondra sous 24h.
              </p>
              
              <div className="mt-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Email Direct</p>
                    <a href="mailto:pubrush.app@gmail.com" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">pubrush.app@gmail.com</a>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-violet-500">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Réseaux Sociaux</p>
                    <p className="text-sm font-semibold text-slate-300">@pubrush_app</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-900 p-8 rounded-3xl backdrop-blur-sm relative">
              {formSubmitted ? (
                <div className="text-center py-12 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Message envoyé !</h3>
                  <p className="text-sm text-slate-400 max-w-sm">
                    Merci pour votre message. Notre équipe d'animation et de support reviendra vers vous au plus vite.
                  </p>
                  <button 
                    onClick={() => setFormSubmitted(false)}
                    className="mt-6 text-sm font-bold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors resize-none"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-500/10"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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

      {/* Legal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image 
              src="/logo_artistic.png" 
              alt="PubRush Logo" 
              width={28} 
              height={28} 
              className="rounded-lg object-contain"
            />
            <span className="text-base font-extrabold text-white">Pub<span className="text-rose-500">Rush</span></span>
          </div>

          <p className="text-xs text-slate-500 text-center md:text-left order-last md:order-none">
            © {new Date().getFullYear()} PubRush. Tous droits réservés. L'abus d'alcool est dangereux pour la santé, à consommer avec modération.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <Link href="/cgu" className="hover:text-white transition-colors">CGU</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Confidentialité</Link>
            <Link href="/legal" className="hover:text-white transition-colors">Mentions légales</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
