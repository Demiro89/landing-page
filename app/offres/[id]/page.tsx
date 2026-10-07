import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import OfferDetails from '@/components/OfferDetails';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: 'Détails de l’offre | StreamMalin', alternates: { canonical: `/offres/${encodeURIComponent(id)}` }, robots: { index: false, follow: true } };
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegalPage title="Détails de l’offre" updatedAt={null}><OfferDetails id={id} /></LegalPage>;
}
