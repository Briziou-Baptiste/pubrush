import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PubRush - Organisez vos meilleurs barathons entre amis",
  description: "Découvrez PubRush, l'application mobile ultime pour organiser et vivre vos meilleurs barathons (pub crawls). Créez des parcours personnalisés, découvrez des bars à proximité sur la carte interactive, et gérez vos dépenses partagées.",
  keywords: ["barathon", "pub crawl", "bar", "cocktails", "bière", "soirée", "amis", "dépenses", "carte interactive", "pubrush"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
