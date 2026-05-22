import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { COMPANY } from '@/lib/legalConfig';

export const metadata: Metadata = {
  title: 'Gestion des cookies — StreamMalin',
  description: 'Informations sur les cookies utilisés par StreamMalin et la gestion de vos préférences.',
};

const TOC = [
  { id: 'definition', label: 'Qu\'est-ce qu\'un cookie' },
  { id: 'necessaires', label: 'Cookies nécessaires' },
  { id: 'analytics', label: 'Cookies de mesure' },
  { id: 'gestion', label: 'Gérer vos préférences' },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Gestion des cookies"
      intro="Cette page vous informe sur l'utilisation des cookies et traceurs sur le site StreamMalin, ainsi que sur les moyens dont vous disposez pour les gérer."
      toc={TOC}
    >
      <h2 id="definition">1. Qu&apos;est-ce qu&apos;un cookie&nbsp;?</h2>
      <p>
        Un cookie est un petit fichier déposé sur votre terminal (ordinateur, tablette, téléphone) lors
        de la consultation d&apos;un site web. Il permet notamment de mémoriser des informations
        relatives à votre navigation ou à votre session.
      </p>

      <h2 id="necessaires">2. Cookies strictement nécessaires</h2>
      <p>
        StreamMalin utilise uniquement des cookies <strong>strictement nécessaires</strong> au
        fonctionnement du service. Ces cookies ne requièrent pas votre consentement préalable, car ils
        sont indispensables à la fourniture du service que vous avez demandé. Ils servent à&nbsp;:
      </p>
      <ul>
        <li>maintenir votre session une fois connecté à votre espace client&nbsp;;</li>
        <li>sécuriser l&apos;accès à l&apos;espace d&apos;administration&nbsp;;</li>
        <li>assurer le bon déroulement du tunnel de commande et de paiement.</li>
      </ul>
      <p>
        Ces cookies ne sont pas utilisés à des fins publicitaires et ne permettent pas de vous suivre
        sur d&apos;autres sites.
      </p>

      <h2 id="analytics">3. Cookies de mesure d&apos;audience et publicitaires</h2>
      <div className="legal-callout">
        <p>
          À ce jour, StreamMalin <strong>n&apos;utilise aucun cookie analytique, de mesure
          d&apos;audience ou publicitaire</strong>. Aucune bannière de consentement n&apos;est donc
          nécessaire.
        </p>
      </div>
      <p>
        Si de tels cookies non essentiels venaient à être ajoutés à l&apos;avenir, un dispositif de
        recueil du consentement (bannière permettant d&apos;accepter, de refuser ou de personnaliser
        votre choix) serait mis en place préalablement à leur dépôt, et cette page serait mise à jour
        en conséquence.
      </p>

      <h2 id="gestion">4. Gérer vos préférences</h2>
      <p>
        Vous pouvez à tout moment configurer votre navigateur pour accepter ou refuser les cookies, ou
        supprimer ceux déjà enregistrés. Le refus des cookies strictement nécessaires peut toutefois
        empêcher le bon fonctionnement de certaines fonctionnalités (connexion à l&apos;espace client,
        paiement). La gestion des cookies s&apos;effectue depuis les paramètres de votre navigateur
        (Chrome, Firefox, Safari, Edge, etc.).
      </p>
      <p>
        Pour toute question relative aux cookies, vous pouvez nous écrire à
        {' '}<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}
