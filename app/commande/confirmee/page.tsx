import { Suspense } from 'react';
import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import OrderConfirmation from '@/components/OrderConfirmation';
import '@/components/public-pages.css';

export const metadata: Metadata = {
  title: 'Suivi de commande | StreamMalin',
  robots: { index: false, follow: false },
  alternates: { canonical: '/commande/confirmee' },
};

export default function ConfirmationPage() {
  return (
    <div className="site-theme public-shell">
      <SiteHeader />
      <main className="confirmation-wrap">
        <Suspense
          fallback={
            <div className="confirmation-card">
              <span className="confirmation-badge">Vérification en cours</span>
              <h1>Suivi de votre commande</h1>
              <p className="confirmation-status-copy" role="status">Vérification du paiement…</p>
            </div>
          }
        >
          <OrderConfirmation />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
