import Link from 'next/link';
import { ArrowLeft, Headphones, UserRound } from 'lucide-react';
import Footer from './Footer';
import './public-pages.css';

export default function PublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-shell">
      <header className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <span className="nav-logo-icon">SM</span>
            <span className="gradient-text">StreamMalin</span>
          </Link>
          <nav className="public-page-nav" aria-label="Navigation principale">
            <Link href="/contact" aria-label="Contacter le support">
              <Headphones size={18} aria-hidden="true" />
              <span>Support</span>
            </Link>
            <Link href="/espace-client" aria-label="Espace client">
              <UserRound size={18} aria-hidden="true" />
              <span>Espace client</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="public-page-wrap">
        <Link href="/#offres" className="public-back">
          <ArrowLeft size={16} aria-hidden="true" /> Retour aux abonnements
        </Link>
        {children}
      </main>
      <Footer />
    </div>
  );
}
