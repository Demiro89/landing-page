import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { NON_AFFILIATION_LONG } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Non-affiliation — StreamMalin',
  description: 'Mention de non-affiliation de StreamMalin aux plateformes citées.',
};

export default function NonAffiliationPage() {
  return (
    <LegalPage
      title="Non-affiliation"
      intro="StreamMalin est un service indépendant des plateformes et marques citées sur le site."
    >
      <div className="legal-callout">
        <p>{NON_AFFILIATION_LONG}</p>
      </div>
    </LegalPage>
  );
}
