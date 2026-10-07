import React from 'react';
import Link from 'next/link';
import Footer from './Footer';
import { LEGAL_LAST_UPDATED } from '@/lib/legalConfig';

export default function LegalPage({
  title,
  intro,
  toc,
  children,
  updatedAt = LEGAL_LAST_UPDATED,
}: {
  title: string;
  intro?: string;
  toc?: { id: string; label: string }[];
  children: React.ReactNode;
  updatedAt?: string | null;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <header className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span className="gradient-text">StreamMalin</span>
          </Link>
          <Link href="/" className="btn btn-ghost btn-sm">← Accueil</Link>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <article className="legal-wrap">
          <h1>{title}</h1>
          {updatedAt && <div className="legal-updated">Dernière mise à jour : {updatedAt}</div>}
          {intro && <p style={{ marginBottom: 24 }}>{intro}</p>}
          {toc && toc.length > 0 && (
            <nav className="legal-toc" aria-label="Sommaire">
              {toc.map(t => (
                <a key={t.id} href={`#${t.id}`}>{t.label}</a>
              ))}
            </nav>
          )}
          {children}
        </article>
      </main>

      <Footer />
    </div>
  );
}
