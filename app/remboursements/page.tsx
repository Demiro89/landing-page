import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Remboursements — StreamMalin',
  description: 'Conditions de remboursement et exclusions applicables aux commandes StreamMalin.',
};

export default function RemboursementsPage() {
  return (
    <LegalPage
      title="Remboursements"
      intro="Les demandes de remboursement sont examinées par le support selon les CGV, la nature du dysfonctionnement et les informations fournies lors de la commande."
    >
      <p>
        En cas de dysfonctionnement avéré imputable à StreamMalin, le support peut proposer une
        assistance, un remplacement selon disponibilité ou un remboursement au prorata de la période
        non utilisée.
      </p>
      <p>
        Les restrictions propres au compte du client, les informations erronées, les usages non
        conformes, les changements décidés par une plateforme tierce ou les demandes formulées sans
        contact préalable avec le support peuvent être exclus du remboursement.
      </p>
      <p>
        Pour toute demande, écrivez à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> avec le
        numéro de commande et les éléments permettant d&apos;analyser la situation.
      </p>
    </LegalPage>
  );
}
