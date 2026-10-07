import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Remboursements — StreamMalin',
  description: 'Conditions de remboursement et exclusions applicables aux commandes StreamMalin.',
  alternates: { canonical: '/remboursements' },
};

export default function RemboursementsPage() {
  return (
    <LegalPage
      title="Remboursements"
      updatedAt="7 octobre 2026"
      intro="Les demandes de remboursement sont examinées par le support selon les CGV, la nature du dysfonctionnement et les informations fournies lors de la commande."
    >
      <p>
        En cas d&apos;absence de fourniture ou de dysfonctionnement, le support recherche une solution adaptée :
        assistance, mise en conformité, remplacement, réduction de prix ou remboursement selon les conditions applicables.
        Les droits légaux, notamment la garantie légale de conformité des contenus et services numériques lorsqu&apos;elle s&apos;applique, restent intégralement applicables.
      </p>
      <p>
        Les circonstances et les informations communiquées avant la commande sont prises en compte dans l&apos;examen d&apos;une demande.
        Une restriction de compte, une modification décidée par une plateforme tierce ou l&apos;absence de contact préalable avec le support ne justifie pas une exclusion générale des droits légaux ou du remboursement.
      </p>
      <p>
        Pour toute demande, écrivez à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> avec le
        numéro de commande et les éléments permettant d&apos;analyser la situation.
      </p>
    </LegalPage>
  );
}
