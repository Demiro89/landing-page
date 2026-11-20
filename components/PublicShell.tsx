import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Footer from './Footer';
import SiteHeader from './SiteHeader';
import './public-pages.css';

export default function PublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-theme public-shell">
      <SiteHeader />
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
