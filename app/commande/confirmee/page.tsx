import { Suspense } from 'react';
import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import OrderConfirmation from '@/components/OrderConfirmation';

export const metadata: Metadata = { title: 'Suivi de commande | StreamMalin', robots: { index: false, follow: false }, alternates: { canonical: '/commande/confirmee' } };
export default function ConfirmationPage() {
  return <LegalPage title="Suivi de votre commande" updatedAt={null}><Suspense fallback={<p>Vérification du paiement…</p>}><OrderConfirmation /></Suspense></LegalPage>;
}
