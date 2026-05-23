import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import {
  COMPANY,
  CURRENT_VAT_EXEMPTION_TEXT,
  NON_AFFILIATION_LONG,
  SERVICE_DESCRIPTION,
  SERVICE_NATURE,
  MEDIATION,
} from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — StreamMalin',
  description: 'Conditions générales de vente du service StreamMalin : mise à disposition temporaire d\'accès numériques.',
};

const TOC = [
  { id: 'vendeur', label: 'Identité du vendeur' },
  { id: 'objet', label: 'Objet & nature du service' },
  { id: 'commande', label: 'Commande' },
  { id: 'prix', label: 'Prix' },
  { id: 'paiement', label: 'Paiement' },
  { id: 'activation', label: 'Activation' },
  { id: 'eligibilite', label: 'Éligibilité' },
  { id: 'retractation', label: 'Rétractation' },
  { id: 'remboursements', label: 'Remboursements' },
  { id: 'reclamations', label: 'Réclamations' },
  { id: 'mediation', label: 'Médiation' },
  { id: 'non-affiliation', label: 'Non-affiliation' },
  { id: 'droit', label: 'Loi applicable' },
];

export default function CGVPage() {
  return (
    <LegalPage
      title="Conditions Générales de Vente"
      intro="Les présentes conditions générales de vente (ci-après « CGV ») régissent l'ensemble des prestations proposées par StreamMalin à ses clients. Toute commande passée sur le site implique l'acceptation pleine et entière des présentes CGV."
      toc={TOC}
    >
      <h2 id="vendeur">1. Identité du vendeur</h2>
      <p>Le service StreamMalin est édité et exploité par&nbsp;:</p>
      <table className="legal-info-table">
        <tbody>
          <tr><td>Exploitant</td><td>{COMPANY.legalName}</td></tr>
          <tr><td>Nom commercial</td><td>{COMPANY.brandName}</td></tr>
          <tr><td>Statut juridique</td><td>{COMPANY.status}</td></tr>
          <tr><td>SIREN</td><td>{COMPANY.siren}</td></tr>
          {COMPANY.siret && <tr><td>SIRET</td><td>{COMPANY.siret}</td></tr>}
          <tr><td>Immatriculation</td><td>{COMPANY.rcs}</td></tr>
          <tr><td>Adresse professionnelle</td><td>{COMPANY.address}</td></tr>
          <tr><td>Adresse e-mail</td><td>{COMPANY.email}</td></tr>
        </tbody>
      </table>
      <p>
        L&apos;exploitant agit en qualité d&apos;entrepreneur individuel sous le régime de la micro-entreprise.
        Conformément à son régime fiscal, la TVA n&apos;est pas facturée&nbsp;: <strong>{CURRENT_VAT_EXEMPTION_TEXT}</strong>.
      </p>

      <h2 id="objet">2. Objet et nature du service</h2>
      <p>{SERVICE_DESCRIPTION}</p>
      <div className="legal-callout">
        <p>{SERVICE_NATURE}</p>
      </div>
      <p>
        StreamMalin met à disposition de ses clients un accès numérique temporaire et personnel à des
        services tiers (streaming vidéo, musique, productivité, etc.) pour la durée de l&apos;offre souscrite.
        Le service ne constitue en aucun cas la vente définitive d&apos;un abonnement, d&apos;un compte
        utilisateur ou d&apos;un droit de propriété. À l&apos;issue de la période souscrite, le droit
        d&apos;accès prend fin, sauf renouvellement.
      </p>

      <h2 id="commande">3. Modalités de commande</h2>
      <p>
        Le client sélectionne une offre sur le site, renseigne les informations nécessaires à la
        livraison de l&apos;accès (adresse e-mail, et le cas échéant l&apos;adresse e-mail liée au compte
        concerné) puis valide sa commande. Avant tout paiement, le client doit&nbsp;:
      </p>
      <ul>
        <li>accepter expressément les présentes CGV&nbsp;;</li>
        <li>
          demander l&apos;exécution immédiate du service et reconnaître qu&apos;une fois l&apos;accès fourni,
          il renonce à son droit de rétractation (voir article 8).
        </li>
        <li>
          confirmer avoir vérifié l&apos;éligibilité de son compte à l&apos;offre choisie, notamment
          l&apos;absence de restriction récente liée à un groupe familial, un pays, un foyer ou un
          historique d&apos;utilisation.
        </li>
      </ul>
      <p>
        La commande n&apos;est définitive qu&apos;après confirmation du paiement. Un e-mail de confirmation
        récapitulant la commande est adressé au client.
      </p>

      <h2 id="prix">4. Prix</h2>
      <p>
        Les prix sont indiqués en euros (€), toutes taxes comprises. En application du régime de la
        franchise en base de TVA, aucune TVA n&apos;est facturée&nbsp;: <strong>{CURRENT_VAT_EXEMPTION_TEXT}</strong>.
        Le prix applicable est celui affiché sur le site au moment de la validation de la commande.
        StreamMalin se réserve le droit de modifier ses prix à tout moment, les offres en cours
        n&apos;étant pas affectées.
      </p>

      <h2 id="paiement">5. Paiement</h2>
      <p>
        Le paiement s&apos;effectue au moment de la commande par les moyens proposés sur le site,
        notamment&nbsp;:
      </p>
      <ul>
        <li><strong>Carte bancaire</strong>, via le prestataire de paiement sécurisé Stripe&nbsp;;</li>
        <li><strong>PayPal</strong> — le client est invité à utiliser exclusivement l&apos;option « Biens et Services » afin de bénéficier d&apos;un paiement traçable.</li>
      </ul>
      <p>
        Les données bancaires ne transitent jamais par les serveurs de StreamMalin et sont traitées
        directement par les prestataires de paiement, dans un environnement chiffré et sécurisé.
        Certaines offres peuvent faire l&apos;objet d&apos;un paiement récurrent mensuel&nbsp;; le client en
        est informé avant la validation et peut y mettre fin à tout moment depuis son espace client.
      </p>

      <h2 id="activation">6. Activation du service</h2>
      <p>
        L&apos;accès numérique est mis à disposition du client dans les meilleurs délais après
        confirmation du paiement et selon la disponibilité de l&apos;offre choisie.
        Les informations d&apos;accès sont transmises à l&apos;adresse e-mail communiquée lors de la
        commande. Le client est responsable de l&apos;exactitude des informations fournies&nbsp;; il
        s&apos;engage à conserver l&apos;accès confidentiel et à en faire un usage strictement personnel.
      </p>
      <p>
        Le fonctionnement effectif de certains accès dépend de plateformes tierces indépendantes de
        StreamMalin. Ces plateformes peuvent modifier leurs règles techniques, familiales, tarifaires
        ou géographiques. StreamMalin assure un suivi des accès et une assistance en cas de
        dysfonctionnement, sans pouvoir garantir l&apos;absence totale d&apos;interruption liée à un tiers.
      </p>

      <h2 id="eligibilite">7. Éligibilité du client et restrictions des plateformes tierces</h2>
      <p>
        Le client doit s&apos;assurer avant la commande que son compte personnel est compatible avec
        l&apos;offre choisie. Certaines plateformes peuvent appliquer des restrictions liées au pays, au
        foyer, au groupe familial, à l&apos;âge du compte, à une invitation récente ou à l&apos;historique
        d&apos;utilisation. Le client reconnaît que ces restrictions relèvent des plateformes concernées.
      </p>
      <p>
        En cas d&apos;incompatibilité connue ou prévisible du compte du client, la commande ne doit pas
        être passée. Une impossibilité d&apos;activation due à une restriction propre au compte du client
        peut constituer une exclusion de remboursement, sous réserve de l&apos;analyse du support.
      </p>

      <h2 id="retractation">8. Droit de rétractation</h2>
      <p>
        Conformément aux articles L.221-18 et suivants du Code de la consommation, le consommateur
        dispose en principe d&apos;un délai de quatorze (14) jours pour exercer son droit de rétractation.
      </p>
      <div className="legal-callout">
        <p>
          Toutefois, en application de l&apos;article L.221-28 du Code de la consommation, le droit de
          rétractation ne peut être exercé pour les contrats de fourniture d&apos;un contenu numérique
          non fourni sur un support matériel dont l&apos;exécution a commencé après accord préalable
          exprès du consommateur et renoncement exprès à son droit de rétractation.
        </p>
        <p>
          En cochant la case prévue à cet effet lors de la commande, le client <strong>demande
          expressément l&apos;exécution immédiate du service</strong> et <strong>reconnaît perdre son
          droit de rétractation</strong> dès que l&apos;accès numérique lui a été fourni.
        </p>
      </div>
      <p>
        Tant que l&apos;accès n&apos;a pas été fourni, le client peut renoncer à sa commande en
        contactant StreamMalin à l&apos;adresse <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2 id="remboursements">9. Remboursements & exclusions</h2>
      <p>
        En cas de dysfonctionnement avéré de l&apos;accès fourni et imputable à StreamMalin,
        StreamMalin s&apos;engage à proposer, dans les meilleurs délais, soit un remplacement de
        l&apos;accès, soit un remboursement au prorata de la période non utilisée. Aucune demande de
        remboursement ne pourra être satisfaite en cas d&apos;usage non conforme aux présentes CGV, de
        partage de l&apos;accès avec un tiers ou de modification des informations d&apos;accès par le
        client. Toute demande est à adresser au support à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
      <p>
        Sont notamment exclus du remboursement&nbsp;: les restrictions propres au compte du client,
        les informations erronées fournies lors de la commande, le refus ou l&apos;impossibilité
        d&apos;accepter une invitation compatible, les changements décidés par une plateforme tierce, les
        usages contraires aux règles de la plateforme ou aux présentes CGV, ainsi que toute demande
        formulée sans avoir préalablement contacté le support StreamMalin.
      </p>

      <h2 id="reclamations">10. Réclamations et litiges de paiement</h2>
      <p>
        Toute réclamation relative à une commande doit être adressée au service client de StreamMalin
        par e-mail à <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, en précisant le numéro de
        commande concerné. StreamMalin s&apos;engage à accuser réception de toute réclamation et à y
        apporter une réponse dans un délai raisonnable.
      </p>
      <p>
        Le client s&apos;engage à contacter le support StreamMalin et à laisser un délai raisonnable de
        traitement avant d&apos;ouvrir un litige ou une opposition auprès de Stripe, PayPal ou de tout
        autre prestataire de paiement, sauf fraude manifeste ou impossibilité objective de contacter
        le support.
      </p>

      <h2 id="mediation">11. Médiation de la consommation</h2>
      <p>
        Conformément aux articles L.612-1 et suivants du Code de la consommation, le client
        consommateur a le droit de recourir gratuitement à un médiateur de la consommation en vue de la
        résolution amiable d&apos;un litige qui l&apos;opposerait à StreamMalin.
      </p>
      <p>
        Conformément aux dispositions du Code de la consommation concernant le processus de médiation
        des litiges de la consommation, après nous avoir sollicités et à défaut de réponse vous
        satisfaisant, vous avez la possibilité de recourir gratuitement à une procédure de médiation
        de la consommation auprès du médiateur dont relève StreamMalin&nbsp;:
      </p>
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
      <p>
        La médiation ne peut être engagée qu&apos;à l&apos;initiative du consommateur, après une démarche
        écrite préalable auprès du support StreamMalin restée sans solution satisfaisante.
        Pour les litiges transfrontaliers au sein de l&apos;Union européenne, le consommateur peut
        également se rapprocher du Centre Européen des Consommateurs compétent.
      </p>

      <h2 id="non-affiliation">12. Non-affiliation</h2>
      <div className="legal-callout">
        <p>{NON_AFFILIATION_LONG}</p>
      </div>

      <h2 id="droit">13. Loi applicable et juridiction</h2>
      <p>
        Les présentes CGV sont soumises au droit français. En cas de litige et à défaut de résolution
        amiable, les tribunaux français seront seuls compétents. Les présentes CGV peuvent être mises à
        jour à tout moment&nbsp;; la version applicable est celle en vigueur à la date de la commande.
      </p>
    </LegalPage>
  );
}
