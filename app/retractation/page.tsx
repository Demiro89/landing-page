import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Droit de rétractation — StreamMalin',
  description: 'Informations sur le droit de rétractation applicable aux accès numériques StreamMalin.',
};

export default function RetractationPage() {
  return (
    <LegalPage
      title="Droit de rétractation"
      intro="Les offres StreamMalin portent sur la mise à disposition d'un accès numérique. Des règles particulières s'appliquent lorsque l'exécution commence immédiatement à la demande du client."
    >
      <p>
        Avant paiement, le client peut demander l&apos;exécution immédiate du service et reconnaître
        renoncer à son droit de rétractation une fois l&apos;accès numérique transmis, conformément aux
        CGV.
      </p>
      <p>
        Tant que l&apos;accès n&apos;a pas été fourni, une demande peut être adressée à
        {' '}<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Après transmission de l&apos;accès,
        les demandes sont traitées selon les conditions de remboursement prévues aux CGV.
      </p>
    </LegalPage>
  );
}
