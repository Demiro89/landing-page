import type { Metadata } from 'next';
import PublicShell from '@/components/PublicShell';
import OfferDetails from '@/components/OfferDetails';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: 'Détails de l’offre | StreamMalin', alternates: { canonical: `/offres/${encodeURIComponent(id)}` }, robots: { index: false, follow: true } };
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicShell><OfferDetails key={id} id={id} /></PublicShell>;
}
