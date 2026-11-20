'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Headphones, Play, UserRound } from 'lucide-react';
import './site-design.css';

export function SiteWordmark() {
  return <>
    <span className="site-wordmark-icon" aria-hidden="true"><Play size={16} fill="currentColor" /></span>
    <span>StreamMalin<span className="site-wordmark-period">.</span></span>
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
    <UserRound size={17} aria-hidden="true" />
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
            <Link href="/#offres" className="site-return"><ArrowLeft size={17} aria-hidden="true" /> Boutique</Link>
          ) : (
            <>
              <Link
                href="/contact"
                className="site-support"
                aria-label="Contacter le support"
                title="Support"
                aria-current={pathname === '/contact' ? 'page' : undefined}
              >
                <Headphones size={17} aria-hidden="true" /><span>Support</span>
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
