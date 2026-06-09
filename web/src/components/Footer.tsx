import React from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand}>
          <Image 
            src="/logo_artistic.png" 
            alt="PubRush Logo" 
            width={28} 
            height={28} 
            className="rounded-lg object-contain"
          />
          <span className={styles.brandText}>
            Pub<span className={styles.brandHighlight}>Rush</span>
          </span>
        </Link>

        <p className={styles.warning}>
          © {new Date().getFullYear()} PubRush. Tous droits réservés.
          <br />
          <span className={styles.alcoholWarning}>
            L'abus d'alcool est dangereux pour la santé, à consommer avec modération.
          </span>
        </p>

        <div className={styles.links}>
          <Link href="/cgu" className={styles.link}>CGU</Link>
          <Link href="/privacy" className={styles.link}>Confidentialité</Link>
          <Link href="/legal" className={styles.link}>Mentions légales</Link>
        </div>
      </div>
    </footer>
  );
}
