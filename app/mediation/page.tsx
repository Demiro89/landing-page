import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { MEDIATION } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Médiation de la consommation — StreamMalin',
  description: 'Informations sur la médiation de la consommation applicable à StreamMalin.',
};

export default function MediationPage() {
  return (
    <LegalPage
      title="Médiation de la consommation"
      intro="Après avoir contacté StreamMalin et à défaut de réponse satisfaisante, un client consommateur peut recourir gratuitement à un médiateur de la consommation."
    >
      <table className="legal-info-table">
        <tbody>
          <tr><td>Médiateur</td><td>{MEDIATION.name}</td></tr>
          <tr><td>Adresse</td><td>{MEDIATION.address}</td></tr>
          <tr><td>Téléphone</td><td>{MEDIATION.phone}</td></tr>
          <tr><td>E-mail</td><td><a href={`mailto:${MEDIATION.email}`}>{MEDIATION.email}</a></td></tr>
          <tr><td>Saisir une médiation</td><td><a href={MEDIATION.declareUrl} target="_blank" rel="noopener noreferrer">{MEDIATION.declareUrl}</a></td></tr>
          <tr><td>Agrément</td><td>{MEDIATION.approval}</td></tr>
        </tbody>
      </table>
    </LegalPage>
  );
}
