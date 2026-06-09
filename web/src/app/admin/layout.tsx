"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut, 
  ArrowLeft,
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { api } from "./api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const verifyAdmin = async () => {
      const token = localStorage.getItem("pubrush_token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const user = await api.getMe();
        if (user.is_admin) {
          setAdminUser(user);
          setLoading(false);
        } else {
          router.push("/profile");
        }
      } catch (error) {
        localStorage.removeItem("pubrush_token");
        router.push("/login");
      }
    };

    verifyAdmin();
  }, [pathname, router]);

  const handleLogout = () => {
    api.logout();
    router.push("/login");
  };

  // Skip rendering sidebar layout if loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 animate-pulse">
            <Image src="/logo.png" alt="PubRush Logo" width={48} height={48} className="rounded-xl object-contain" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-400">Vérification de la session...</span>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      label: "Vue d'ensemble",
      icon: LayoutDashboard,
      href: "/admin",
      active: pathname === "/admin"
    },
    {
      label: "Utilisateurs",
      icon: Users,
      href: "/admin/users",
      active: pathname === "/admin/users"
    },
    {
      label: "Événements & Filtres",
      icon: Calendar,
      href: "/admin/events",
      active: pathname === "/admin/events"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:w-64 border-r border-slate-900 bg-slate-950/60 backdrop-blur-md flex-col shrink-0">
        {/* Brand */}
        <div className="h-20 px-6 border-b border-slate-900 flex items-center gap-3">
          <Image src="/logo.png" alt="PubRush Logo" width={32} height={32} className="rounded-lg object-contain" />
          <span className="text-xl font-black text-white">
            Pub<span className="text-rose-500">Rush</span>
          </span>
          <span className="text-[9px] font-bold tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded uppercase">Admin</span>
        </div>

        {/* User Block */}
        <div className="px-4 py-6 border-b border-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold uppercase">
            {adminUser?.username?.substring(0, 2) || "AD"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{adminUser?.username}</p>
            <p className="text-xs text-slate-500 truncate">{adminUser?.email}</p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {menuItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                item.active 
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/50 border border-transparent"
              }`}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-900 space-y-1">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors rounded-xl">
            <ArrowLeft className="w-4.5 h-4.5" />
            Retour au site
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-all rounded-xl cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar - Mobile & Desktop breadcrumbs */}
        <header className="h-20 border-b border-slate-900/80 bg-slate-950/40 backdrop-blur-md px-6 flex items-center justify-between lg:justify-end">
          {/* Mobile hamburger menu */}
          <div className="flex items-center gap-3 lg:hidden">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-white">PubRush Admin</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Connexion sécurisée
            </div>
            <div className="w-px h-6 bg-slate-800 hidden sm:block" />
            <span className="text-sm text-slate-400">
              Session : <span className="font-bold text-slate-200">{adminUser?.username}</span>
            </span>
          </div>
        </header>

        {/* Page children */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-10">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-950/80 backdrop-blur-sm">
          <div className="w-64 bg-slate-950 border-r border-slate-900 flex flex-col h-full animate-in slide-in-from-left duration-300">
            {/* Mobile Sidebar Header */}
            <div className="h-20 px-6 border-b border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="PubRush Logo" width={28} height={28} className="rounded-lg object-contain" />
                <span className="text-lg font-black text-white">Pub<span className="text-rose-500">Rush</span></span>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile User Block */}
            <div className="px-4 py-5 border-b border-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-center text-violet-400 font-bold uppercase text-xs">
                {adminUser?.username?.substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{adminUser?.username}</p>
                <p className="text-[10px] text-slate-500 truncate">{adminUser?.email}</p>
              </div>
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex-1 px-3 py-6 space-y-1">
              {menuItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    item.active 
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50 border border-transparent"
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Bottom Actions */}
            <div className="p-4 border-t border-slate-900 space-y-1">
              <Link href="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-400 hover:text-white transition-colors rounded-xl">
                <ArrowLeft className="w-4.5 h-4.5" />
                Retour au site
              </Link>
              <button 
                onClick={() => {
                  setSidebarOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition-all rounded-xl cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5" />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
