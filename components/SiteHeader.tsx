'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Headphones, UserRound } from 'lucide-react';
import './site-design.css';

export function SiteWordmark() {
  return <>
    <span className="site-wordmark-mark" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect className="site-wordmark-frame" x="1" y="1" width="26" height="26" rx="8" fill="#161412" />
        <rect x="4.75" y="6.75" width="18.5" height="14.5" rx="3.25" stroke="#dfd8cb" strokeWidth="1.2" strokeOpacity="0.4" />
        <path d="M12 10.4L18.4 14L12 17.6V10.4Z" fill="#c4452b" />
      </svg>
    </span>
    <span className="site-wordmark-text">StreamMalin</span>
  </>;
}

export default function SiteHeader({ checkout = false, account = false, onHome, onAccount }: {
  checkout?: boolean;
  account?: boolean;
  onHome?: () => void;
  onAccount?: () => void;
}) {
  const pathname = usePathname() || '';
  const accountContent = <>
    <UserRound size={16} aria-hidden="true" />
    <span className="site-account-full">Espace client</span>
    <span className="site-account-short">Compte</span>
  </>;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {onHome
          ? <button type="button" onClick={onHome} className="site-wordmark"><SiteWordmark /></button>
          : <Link href="/" className="site-wordmark"><SiteWordmark /></Link>}
        {!checkout && (
          <nav className="site-navigation" aria-label="Navigation principale">
            <Link href="/#offres" onClick={onHome} aria-current={pathname.startsWith('/offres') ? 'page' : undefined}>Abonnements</Link>
            <Link href="/#calculateur" onClick={onHome}>Simulateur</Link>
            <Link href="/#faq" onClick={onHome}>FAQ</Link>
          </nav>
        )}
        <div className="site-header-actions">
          {checkout ? (
            <Link href="/#offres" className="site-return"><ArrowLeft size={16} aria-hidden="true" /> Retour aux offres</Link>
          ) : (
            <>
              <Link
                href="/contact"
                className="site-support"
                aria-label="Contacter le support"
                title="Support"
                aria-current={pathname === '/contact' ? 'page' : undefined}
              >
                <Headphones size={16} aria-hidden="true" /><span>Support</span>
              </Link>
              {onAccount
                ? <button type="button" className="site-account" onClick={onAccount} aria-label="Espace client" title="Espace client" aria-current={account ? 'page' : undefined}>{accountContent}</button>
                : <Link href="/espace-client" className="site-account" aria-label="Espace client" title="Espace client">{accountContent}</Link>}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
