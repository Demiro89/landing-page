import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY, HOST, NON_AFFILIATION_LONG } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Mentions légales — StreamMalin',
  description: 'Mentions légales du site StreamMalin.',
};

const TOC = [
  { id: 'editeur', label: 'Éditeur' },
  { id: 'directeur', label: 'Publication' },
  { id: 'hebergeur', label: 'Hébergeur' },
  { id: 'propriete', label: 'Propriété intellectuelle' },
  { id: 'non-affiliation', label: 'Non-affiliation' },
  { id: 'responsabilite', label: 'Responsabilité' },
];

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique, les informations relatives à l'éditeur et à l'hébergeur du site sont précisées ci-dessous."
      toc={TOC}
    >
      <h2 id="editeur">1. Éditeur du site</h2>
      <table className="legal-info-table">
        <tbody>
          <tr><td>Nom commercial</td><td>{COMPANY.brandName}</td></tr>
          <tr><td>Exploitant</td><td>Nom commercial de {COMPANY.legalName}</td></tr>
          <tr><td>Statut juridique</td><td>{COMPANY.status}</td></tr>
          <tr><td>SIREN</td><td>{COMPANY.siren}</td></tr>
          <tr><td>SIRET</td><td>{COMPANY.siret}</td></tr>
          <tr><td>Adresse professionnelle</td><td>{COMPANY.address}</td></tr>
          <tr><td>Adresse e-mail</td><td><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></td></tr>
          <tr><td>Site web</td><td>{COMPANY.websiteUrl}</td></tr>
        </tbody>
      </table>
      <p>
        L&apos;exploitant agit en qualité d&apos;entrepreneur individuel sous le régime de la
        micro-entreprise. La TVA n&apos;est pas applicable conformément à l&apos;article 293 B du Code
        général des impôts (franchise en base de TVA).
      </p>

      <h2 id="directeur">2. Directeur de la publication</h2>
      <p>Le directeur de la publication est&nbsp;: <strong>{COMPANY.publicationDirector}</strong>.</p>

      <h2 id="hebergeur">3. Hébergeur</h2>
      <p>Le site est hébergé par&nbsp;:</p>
      <table className="legal-info-table">
        <tbody>
          <tr><td>Hébergeur</td><td>{HOST.name}</td></tr>
          <tr><td>Adresse</td><td>{HOST.address}</td></tr>
          <tr><td>Site web</td><td><a href={HOST.website} target="_blank" rel="noopener noreferrer">{HOST.website}</a></td></tr>
          <tr><td>Contact</td><td><a href={HOST.contact} target="_blank" rel="noopener noreferrer">{HOST.contact}</a></td></tr>
        </tbody>
      </table>

      <h2 id="propriete">4. Propriété intellectuelle</h2>
      <p>
        La structure générale du site StreamMalin, ainsi que les textes, mises en page, identités
        graphiques et éléments le composant, sont la propriété de l&apos;éditeur ou font l&apos;objet
        d&apos;une autorisation d&apos;utilisation. Toute reproduction, représentation, modification ou
        exploitation, totale ou partielle, de ces éléments, sans autorisation écrite préalable, est
        interdite et constitutive de contrefaçon.
      </p>

      <h2 id="non-affiliation">5. Non-affiliation</h2>
      <div className="legal-callout">
        <p>{NON_AFFILIATION_LONG}</p>
      </div>

      <h2 id="responsabilite">6. Responsabilité</h2>
      <p>
        StreamMalin met tout en œuvre pour assurer l&apos;exactitude des informations diffusées sur le
        site et la disponibilité de ses services. Sa responsabilité ne saurait toutefois être engagée
        en cas d&apos;indisponibilité technique, d&apos;erreur ou d&apos;interruption indépendante de sa
        volonté. Pour toute question relative au site, l&apos;exploitant peut être contacté à
        l&apos;adresse <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}
