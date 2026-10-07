import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';
import WithdrawalForm from '@/components/WithdrawalForm';

export const metadata: Metadata = {
  title: 'Droit de rétractation — StreamMalin',
  description: 'Informations sur le droit de rétractation applicable aux accès numériques StreamMalin.',
  alternates: { canonical: '/retractation' },
};

export default function RetractationPage() {
  return (
    <LegalPage
      title="Droit de rétractation"
      updatedAt="7 octobre 2026"
      intro="Les offres StreamMalin portent sur la mise à disposition d'un accès numérique. Des règles particulières s'appliquent lorsque l'exécution commence immédiatement à la demande du client."
    >
      <p>
        Le consommateur dispose en principe de quatorze jours à compter de la conclusion du contrat.
        La demande d&apos;exécution immédiate ne supprime pas à elle seule ce droit. Les exceptions
        dépendent de la nature du contenu ou du service et des conditions légales, détaillées dans les <a href="/cgv#retractation">CGV</a>.
      </p>
      <p>
        Une déclaration claire peut aussi être adressée à
        {' '}<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Les droits légaux du consommateur restent applicables.
      </p>
      <WithdrawalForm />
    </LegalPage>
  );
}
