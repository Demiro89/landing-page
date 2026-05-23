import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Réclamation — StreamMalin',
  description: 'Modalités de réclamation auprès du support StreamMalin.',
};

export default function ReclamationPage() {
  return (
    <LegalPage
      title="Réclamation"
      intro="Pour toute difficulté liée à une commande, un accès ou un paiement, le support StreamMalin doit être contacté en priorité afin de rechercher une solution amiable."
    >
      <h2>Contacter le support</h2>
      <p>
        Adressez votre demande à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> en indiquant
        votre adresse e-mail de commande, l&apos;offre concernée, le numéro de commande si vous l&apos;avez
        et une description précise du problème rencontré.
      </p>
      <p>
        Le client est invité à attendre le traitement de sa réclamation avant d&apos;ouvrir un litige
        auprès de Stripe, PayPal ou de tout autre prestataire de paiement, sauf fraude manifeste ou
        impossibilité objective de contacter le support.
      </p>
    </LegalPage>
  );
}
