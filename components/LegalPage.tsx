import React from 'react';
import Link from 'next/link';
import Footer from './Footer';
import { LEGAL_LAST_UPDATED } from '@/lib/legalConfig';

export default function LegalPage({
  title,
  intro,
  toc,
  children,
}: {
  title: string;
  intro?: string;
  toc?: { id: string; label: string }[];
  children: React.ReactNode;
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

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute', top: 60, left: '-15%', width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, hsla(262,88%,64%,0.14), transparent 70%)', filter: 'blur(80px)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <main style={{ flex: 1 }}>
        <article className="legal-wrap">
          <h1>{title}</h1>
          <div className="legal-updated">Dernière mise à jour : {LEGAL_LAST_UPDATED}</div>
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
