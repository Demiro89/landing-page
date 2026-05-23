import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — StreamMalin',
  description: 'Politique de confidentialité et de protection des données personnelles de StreamMalin.',
};

const TOC = [
  { id: 'responsable', label: 'Responsable' },
  { id: 'donnees', label: 'Données collectées' },
  { id: 'finalites', label: 'Finalités' },
  { id: 'prestataires', label: 'Prestataires' },
  { id: 'conservation', label: 'Conservation' },
  { id: 'droits', label: 'Vos droits' },
  { id: 'cnil', label: 'Réclamation CNIL' },
];

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="StreamMalin attache une grande importance à la protection de vos données personnelles. La présente politique décrit les données collectées, leurs finalités, leur durée de conservation et les droits dont vous disposez, conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés."
      toc={TOC}
    >
      <h2 id="responsable">1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données est l&apos;exploitant de StreamMalin,
        {' '}{COMPANY.legalName} ({COMPANY.status}). Pour toute question relative à vos données, vous
        pouvez écrire à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2 id="donnees">2. Données collectées</h2>
      <p>Dans le cadre de l&apos;utilisation du service, StreamMalin est susceptible de collecter&nbsp;:</p>
      <ul>
        <li><strong>Adresse e-mail</strong> — pour la création de compte, la livraison de l&apos;accès et le support&nbsp;;</li>
        <li><strong>Nom</strong> — uniquement s&apos;il est fourni volontairement par le client&nbsp;;</li>
        <li><strong>Données de commande</strong> — offre souscrite, date, montant, statut, moyen de paiement choisi, identifiant de commande&nbsp;;</li>
        <li><strong>Données de paiement</strong> — traitées par les prestataires de paiement&nbsp;; StreamMalin ne conserve pas le numéro de carte bancaire, mais peut conserver des données limitées (4 derniers chiffres, type de carte, identifiants Stripe ou PayPal lorsque nécessaires au suivi de la commande)&nbsp;;</li>
        <li><strong>Preuves contractuelles</strong> — date d&apos;acceptation des CGV, date d&apos;acceptation de la renonciation au droit de rétractation, date de confirmation d&apos;éligibilité et version des CGV acceptée&nbsp;;</li>
        <li><strong>Données techniques et journaux</strong> — adresse IP, type de navigateur (user-agent), horodatage, notamment afin de conserver la preuve de l&apos;acceptation des conditions de vente, de sécuriser le service et de prévenir la fraude&nbsp;;</li>
        <li><strong>Messages de support</strong> — échanges transmis via l&apos;espace client, par e-mail ou, lorsque le service l&apos;utilise, via Telegram pour les notifications internes de support et de suivi des commandes.</li>
      </ul>

      <h2 id="finalites">3. Finalités et bases légales</h2>
      <ul>
        <li><strong>Gestion des commandes et livraison de l&apos;accès</strong> — exécution du contrat&nbsp;;</li>
        <li><strong>Conservation des preuves contractuelles</strong> — exécution du contrat, intérêt légitime et gestion des litiges&nbsp;;</li>
        <li><strong>Traitement des paiements</strong> — exécution du contrat&nbsp;;</li>
        <li><strong>Support client et réclamations</strong> — exécution du contrat et intérêt légitime&nbsp;;</li>
        <li><strong>Gestion des litiges et demandes Stripe/PayPal</strong> — intérêt légitime et défense des droits&nbsp;;</li>
        <li><strong>Facturation et obligations comptables</strong> — obligation légale&nbsp;;</li>
        <li><strong>Sécurité du service et prévention de la fraude</strong> — intérêt légitime&nbsp;;</li>
        <li><strong>Respect des obligations légales</strong> — obligation légale.</li>
      </ul>

      <h2 id="prestataires">4. Destinataires et prestataires</h2>
      <p>
        Les données ne sont jamais vendues. Elles sont susceptibles d&apos;être transmises aux seuls
        prestataires strictement nécessaires au fonctionnement du service&nbsp;:
      </p>
      <ul>
        <li><strong>Stripe</strong> — traitement des paiements par carte bancaire&nbsp;;</li>
        <li><strong>PayPal</strong> — traitement des paiements PayPal&nbsp;;</li>
        <li><strong>Vercel</strong> — hébergement du site et des journaux techniques&nbsp;;</li>
        <li><strong>Resend</strong> — envoi des e-mails transactionnels&nbsp;;</li>
        <li><strong>Telegram</strong> — notifications internes de support et de suivi des commandes lorsque configuré&nbsp;;</li>
        <li><strong>Fournisseur de base de données</strong> — stockage sécurisé des données de commande.</li>
      </ul>
      <p>
        Certains de ces prestataires peuvent être situés hors de l&apos;Union européenne&nbsp;; dans ce
        cas, les transferts sont encadrés par des garanties appropriées (clauses contractuelles types).
      </p>

      <h2 id="conservation">5. Durée de conservation</h2>
      <ul>
        <li><strong>Données de compte</strong> — conservées tant que le compte est actif, puis supprimées sur demande&nbsp;;</li>
        <li><strong>Données de commande et de facturation</strong> — conservées dix (10) ans au titre des obligations comptables et fiscales&nbsp;;</li>
        <li><strong>Preuves contractuelles</strong> — conservées avec les données de commande afin d&apos;établir l&apos;acceptation des CGV, la renonciation au droit de rétractation, l&apos;éligibilité déclarée et la version applicable&nbsp;;</li>
        <li><strong>Journaux techniques</strong> — conservés pour une durée limitée à des fins de sécurité (généralement douze mois maximum).</li>
      </ul>

      <h2 id="droits">6. Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants sur vos données&nbsp;:</p>
      <ul>
        <li>droit d&apos;accès&nbsp;;</li>
        <li>droit de rectification&nbsp;;</li>
        <li>droit à l&apos;effacement (dans les limites des obligations légales de conservation)&nbsp;;</li>
        <li>droit à la limitation du traitement&nbsp;;</li>
        <li>droit d&apos;opposition&nbsp;;</li>
        <li>droit à la portabilité des données.</li>
      </ul>
      <p>
        Pour exercer ces droits, écrivez à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Une
        réponse vous sera apportée dans un délai d&apos;un mois.
      </p>

      <h2 id="cnil">7. Réclamation auprès de la CNIL</h2>
      <p>
        Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez
        introduire une réclamation auprès de la Commission Nationale de l&apos;Informatique et des
        Libertés (CNIL) — <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
      </p>
    </LegalPage>
  );
}
