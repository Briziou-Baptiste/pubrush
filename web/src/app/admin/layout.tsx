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
import styles from "./adminLayout.module.css";

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
    <div className={styles.layoutContainer}>
      {/* Sidebar - Desktop */}
      <aside className={styles.sidebarDesktop}>
        {/* Brand */}
        <div className={styles.sidebarBrand}>
          <Image src="/logo.png" alt="PubRush Logo" width={32} height={32} className="rounded-lg object-contain" />
          <span className={styles.brandText}>
            Pub<span className={styles.brandHighlight}>Rush</span>
          </span>
          <span className={styles.adminBadge}>Admin</span>
        </div>

        {/* User Block */}
        <div className={styles.userBlock}>
          <div className={styles.userAvatar}>
            {adminUser?.username?.substring(0, 2) || "AD"}
          </div>
          <div className={styles.userDetails}>
            <p className={styles.userName}>{adminUser?.username}</p>
            <p className={styles.userEmail}>{adminUser?.email}</p>
          </div>
        </div>

        {/* Links */}
        <nav className={styles.navBlock}>
          {menuItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={item.active ? styles.navLinkActive : styles.navLinkInactive}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className={styles.bottomActions}>
          <Link href="/" className={styles.bottomLink}>
            <ArrowLeft className="w-4.5 h-4.5" />
            Retour au site
          </Link>
          <button 
            onClick={handleLogout}
            className={styles.logoutBtn}
          >
            <LogOut className="w-4.5 h-4.5" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainContainer}>
        {/* Top Navbar - Mobile & Desktop breadcrumbs */}
        <header className={styles.headerBar}>
          {/* Mobile hamburger menu */}
          <div className={styles.mobileTitleWrapper}>
            <button 
              onClick={() => setSidebarOpen(true)}
              className={styles.hamburgerBtn}
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-white">PubRush Admin</span>
          </div>

          <div className={styles.headerMeta}>
            <div className={styles.secureBadge}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Connexion sécurisée
            </div>
            <div className={styles.divider} />
            <span className={styles.sessionInfo}>
              Session : <span className={styles.sessionName}>{adminUser?.username}</span>
            </span>
          </div>
        </header>

        {/* Page children */}
        <main className={styles.contentBody}>
          {children}
        </main>
      </div>

      {/* Mobile Drawer Sidebar overlay */}
      {sidebarOpen && (
        <div className={styles.mobileDrawer}>
          <div className={styles.mobileSidebar}>
            {/* Mobile Sidebar Header */}
            <div className={styles.mobileHeader}>
              <div className={styles.mobileBrandWrapper}>
                <Image src="/logo.png" alt="PubRush Logo" width={28} height={28} className="rounded-lg object-contain" />
                <span className="text-lg font-black text-white">Pub<span className={styles.brandHighlight}>Rush</span></span>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className={styles.mobileCloseBtn}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile User Block */}
            <div className={styles.mobileUserBlock}>
              <div className={styles.mobileUserAvatar}>
                {adminUser?.username?.substring(0, 2)}
              </div>
              <div className={styles.userDetails}>
                <p className={styles.userName}>{adminUser?.username}</p>
                <p className={styles.userEmail}>{adminUser?.email}</p>
              </div>
            </div>

            {/* Mobile Nav Links */}
            <nav className={styles.mobileNav}>
              {menuItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={item.active ? styles.navLinkActive : styles.navLinkInactive}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Bottom Actions */}
            <div className={styles.bottomActions}>
              <Link href="/" onClick={() => setSidebarOpen(false)} className={styles.bottomLink}>
                <ArrowLeft className="w-4.5 h-4.5" />
                Retour au site
              </Link>
              <button 
                onClick={() => {
                  setSidebarOpen(false);
                  handleLogout();
                }}
                className={styles.logoutBtn}
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
