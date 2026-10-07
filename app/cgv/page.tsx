import type { Metadata } from 'next';
import TermsDocument from '@/components/legal/TermsDocument';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente | StreamMalin',
  description: 'Prix, commande, renouvellement, éligibilité, rétractation et droits applicables aux accès numériques StreamMalin.',
  alternates: { canonical: '/cgv' },
};
export default TermsDocument;
