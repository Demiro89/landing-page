import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales de Vente — StreamMalin',
  description: "Conditions générales de vente applicables aux services d'abonnement StreamMalin.",
};

export default function CGVPage() {
  return (
    <>
      <Navbar />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '800px',
          margin: '0 auto',
          padding: '90px 24px 80px',
        }}
      >
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--muted)',
            fontSize: '0.85rem',
            textDecoration: 'none',
            marginBottom: '32px',
          }}
        >
          <i className="fa-solid fa-arrow-left" style={{ fontSize: '0.75rem' }} />
          Retour à l&apos;accueil
        </a>

        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '8px',
          }}
        >
          Conditions Générales de Vente
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Dernière mise à jour : mai 2026
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Vendeur : StreamMalin — SAID OUARZAZI EI —{' '}
          <a href="mailto:hello@streammalin.fr" style={{ color: 'var(--muted)' }}>
            hello@streammalin.fr
          </a>
        </p>

        {/* Avertissement */}
        <div
          style={{
            background: 'rgba(255,59,59,0.06)',
            border: '1px solid rgba(255,59,59,0.25)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '40px',
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-start',
          }}
        >
          <i
            className="fa-solid fa-triangle-exclamation"
            style={{ color: '#ff3b3b', fontSize: '1rem', marginTop: '3px', flexShrink: 0 }}
          />
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#ff6b6b', lineHeight: 1.7 }}>
            <strong style={{ color: '#ff3b3b' }}>Important :</strong> En passant commande sur
            StreamMalin, vous acceptez l&apos;intégralité des présentes CGV, notamment
            l&apos;absence de droit de rétractation sur les produits numériques livrés
            immédiatement, et la politique de résiliation immédiate en cas de litige PayPal ou
            Stripe non précédé d&apos;un contact support.
          </p>
        </div>

        {/* Sections */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '36px',
            color: 'var(--muted)',
            fontSize: '0.9rem',
            lineHeight: 1.85,
          }}
        >
          {sections.map((section, i) => (
            <section
              key={i}
              style={{
                borderBottom: i < sections.length - 1 ? '1px solid var(--border)' : 'none',
                paddingBottom: i < sections.length - 1 ? '36px' : '0',
              }}
            >
              <h2
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    background: 'rgba(124,58,237,0.15)',
                    color: '#a78bfa',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {section.title}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: section.content }} />
            </section>
          ))}
        </div>

        {/* Support CTA */}
        <div
          style={{
            marginTop: '48px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '14px' }}>
            Une question sur ces conditions ? Contactez notre support.
          </p>
          <a
            href="mailto:hello@streammalin.fr"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(37,99,235,0.1)',
              border: '1px solid rgba(37,99,235,0.3)',
              color: '#3b82f6',
              borderRadius: '10px',
              padding: '10px 20px',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            <i className="fa-solid fa-envelope" />
            hello@streammalin.fr
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}

const ul = (items: string[]) =>
  `<ul style="padding-left:18px;margin-top:10px;display:flex;flex-direction:column;gap:7px;">${items.map((li) => `<li>${li}</li>`).join('')}</ul>`;

const strong = (text: string) => `<strong style="color:var(--text)">${text}</strong>`;

const warn = (html: string) =>
  `<div style="background:rgba(255,59,59,0.06);border:1px solid rgba(255,59,59,0.2);border-radius:9px;padding:14px 16px;margin-top:14px;font-size:0.86rem;color:#ff6b6b;line-height:1.7;">${html}</div>`;

const info = (html: string) =>
  `<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:9px;padding:14px 16px;margin-top:14px;font-size:0.86rem;color:#60a5fa;line-height:1.7;">${html}</div>`;

const sections = [
  {
    title: 'Identification du vendeur',
    content: `
      <p>Les présentes Conditions Générales de Vente (ci-après « CGV ») sont conclues entre :</p>
      ${ul([
        `${strong('Vendeur')} : SAID OUARZAZI, Entrepreneur Individuel (EI)`,
        `${strong('Nom commercial')} : StreamMalin`,
        `${strong('Adresse professionnelle')} : 4 rue des Acacias, 89200 Avallon, France`,
        `${strong('SIREN')} : en cours d'attribution`,
        `${strong('SIRET')} : en cours d'attribution`,
        `${strong('Email')} : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a>`,
        `${strong('Téléphone')} : 06 99 11 10 23`,
        `${strong('Directeur de la publication')} : SAID OUARZAZI`,
      ])}
      <p style="margin-top:12px;">${strong('Hébergeur du site')} :</p>
      ${ul([
        'Vercel Inc.',
        '340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis',
        'Site : <a href="https://vercel.com" style="color:#60a5fa;" target="_blank" rel="noopener noreferrer">https://vercel.com</a>',
        'Contact : <a href="https://vercel.com/contact" style="color:#60a5fa;" target="_blank" rel="noopener noreferrer">https://vercel.com/contact</a>',
        'Email support : support@vercel.com',
      ])}
      <p style="margin-top:12px;">Et tout client (ci-après « le Client ») passant commande sur le site <strong style="color:var(--text)">streammalin.fr</strong>.</p>
    `,
  },
  {
    title: 'Indépendance vis-à-vis des plateformes tierces',
    content: `
      ${info(`StreamMalin n'est <strong style="color:var(--text)">pas affilié</strong> à YouTube, Google, Disney+, Surfshark, PayPal, Stripe, ni à aucune autre plateforme mentionnée sur ce site. Ces noms sont des marques déposées appartenant à leurs propriétaires respectifs. StreamMalin agit en qualité de revendeur indépendant de places sur des abonnements partagés ou familiaux. L'accès aux services peut dépendre des règles techniques et contractuelles imposées unilatéralement par ces plateformes.`)}
    `,
  },
  {
    title: 'Objet du service',
    content: `
      <p>StreamMalin propose la revente de places sur des abonnements numériques partagés, permettant au Client d'accéder à des contenus de streaming premium à tarif réduit. Les services disponibles sont :</p>
      ${ul([
        `${strong('YouTube Premium Famille')} — Accès via invitation sur le compte Google/Gmail du Client.`,
        `${strong('Disney+ 4K')} — Attribution d'un profil dédié sur un compte Premium.`,
        `${strong('Surfshark VPN One')} — Fourniture de codes d'accès VPN.`,
      ])}
      <p style="margin-top:12px;">StreamMalin fournit un accès numérique. Aucun produit physique n'est livré.</p>
    `,
  },
  {
    title: "Conditions d'éligibilité du client",
    content: `
      <p>Pour passer commande sur StreamMalin, le Client doit :</p>
      ${ul([
        'Être une personne physique majeure (18 ans ou plus) et disposer de la pleine capacité juridique,',
        'Disposer d\'une adresse email valide et active,',
        'Pour YouTube Premium : disposer d\'une adresse Gmail/Google valide sur laquelle l\'invitation sera envoyée,',
        'Accepter les présentes CGV avant tout paiement,',
        'Ne pas avoir fait l\'objet d\'une résiliation antérieure pour violation des présentes CGV.',
      ])}
      <p style="margin-top:12px;">En passant commande, le Client déclare remplir ces conditions.</p>
    `,
  },
  {
    title: 'Commande',
    content: `
      <p>La commande se déroule selon les étapes suivantes :</p>
      ${ul([
        '1. Sélection du service et de la durée d\'abonnement sur la page d\'accueil.',
        '2. Saisie de l\'adresse email de contact (et adresse Gmail pour YouTube Premium).',
        '3. Choix de la méthode de paiement.',
        '4. Acceptation des CGV et de la clause de renonciation au droit de rétractation.',
        '5. Paiement.',
        '6. Déclaration du paiement (pour PayPal et crypto) ou activation immédiate (pour Stripe).',
      ])}
      <p style="margin-top:12px;">La commande est considérée comme ferme et définitive dès validation du paiement et déclaration de celui-ci par le Client. Toute commande vaut acceptation des présentes CGV.</p>
    `,
  },
  {
    title: 'Prix et paiement',
    content: `
      <p>Les prix sont indiqués en euros TTC. StreamMalin, en tant qu'entrepreneur individuel non assujetti à la TVA (franchise en base de TVA), n'applique pas de TVA sur ses prestations.</p>
      <p style="margin-top:10px;">Les moyens de paiement acceptés sont :</p>
      ${ul([
        `${strong('Carte bancaire, Apple Pay, Google Pay')} — via Stripe. Paiement sécurisé, activation immédiate. Libellé sur relevé bancaire : STREAMMALIN.`,
        `${strong('PayPal')} — paiement en mode ${strong('Biens et Services')}, au montant exact de la commande. Le Client doit conserver son ID de transaction PayPal. L'accès est activé après vérification manuelle (sous 1 à 24h).`,
      ])}
      <p style="margin-top:12px;">Aucun paiement en espèces ou par chèque n'est accepté.</p>
    `,
  },
  {
    title: 'Paiement en cryptomonnaies',
    content: `
      ${warn(`<strong style="color:#ff3b3b;">ATTENTION — Réseaux crypto :</strong> Vous devez impérativement utiliser le réseau mentionné pour chaque cryptomonnaie. Tout envoi via un mauvais réseau ou à une mauvaise adresse entraînera la <strong>perte définitive des fonds</strong>. Aucun remboursement ne pourra être effectué dans ce cas.`)}
      <p style="margin-top:14px;">Les cryptomonnaies acceptées et leurs réseaux obligatoires :</p>
      ${ul([
        `${strong('Solana (SOL)')} — réseau Solana uniquement.`,
        `${strong('XRP (Ripple)')} — réseau XRP Ledger uniquement.`,
        `${strong('USDT')} — réseau TRC-20 / TRON uniquement.`,
      ])}
      <p style="margin-top:12px;">Après envoi, le Client doit déclarer son hash de transaction dans le formulaire prévu à cet effet. L'activation intervient après vérification manuelle (sous 1 à 24h).</p>
    `,
  },
  {
    title: 'Livraison et activation',
    content: `
      <p>Les accès sont livrés par voie électronique, selon le mode de paiement :</p>
      ${ul([
        `${strong('Stripe (CB / Apple Pay / Google Pay)')} : activation <strong style="color:var(--text)">immédiate et automatique</strong> dès confirmation du paiement par Stripe.`,
        `${strong('PayPal / Cryptomonnaies')} : activation sous <strong style="color:var(--text)">1 à 24 heures</strong> après vérification manuelle du paiement.`,
      ])}
      <p style="margin-top:12px;">Les identifiants sont transmis par email et disponibles dans l'espace client (dashboard). StreamMalin ne peut être tenu responsable des délais liés à une indisponibilité temporaire des plateformes tierces.</p>
    `,
  },
  {
    title: 'Durée du service',
    content: `
      <p>Les abonnements sont disponibles pour les durées suivantes : ${strong('1 mois, 3 mois, 6 mois ou 12 mois')}, à compter de la date d'activation.</p>
      <p style="margin-top:10px;">${strong("Le renouvellement n'est pas automatique.")} Le Client doit initier une nouvelle commande avant la date d'expiration pour assurer la continuité du service. La date d'expiration est visible dans l'espace client et communiquée par email.</p>
    `,
  },
  {
    title: 'Droit de rétractation',
    content: `
      ${warn(`<strong style="color:#ff3b3b;">Aucun remboursement ne sera effectué une fois les identifiants ou l'invitation envoyés.</strong>`)}
      <p style="margin-top:14px;">Conformément à l'${strong('article L221-28 du Code de la consommation')}, le droit de rétractation de 14 jours ne s'applique pas aux :</p>
      ${ul([
        'Contenus numériques dont l\'exécution a commencé avec l\'accord exprès du consommateur,',
        'Services pleinement exécutés avant la fin du délai de rétractation.',
      ])}
      <p style="margin-top:12px;">En cochant la case correspondante lors de la commande, le Client reconnaît expressément :</p>
      ${ul([
        'Demander l\'exécution immédiate du service,',
        'Renoncer à son droit de rétractation dès la livraison des accès,',
        'Que le service est considéré comme pleinement exécuté à ce stade.',
      ])}
    `,
  },
  {
    title: 'Garantie de fonctionnement',
    content: `
      <p>StreamMalin s'engage à fournir un accès fonctionnel pendant toute la durée de l'abonnement souscrit. En cas de dysfonctionnement technique imputable à StreamMalin (compte désactivé, identifiants invalides, profil inaccessible), le Client bénéficie d'une ${strong('garantie de remplacement')} :</p>
      ${ul([
        'Un accès de substitution équivalent sera fourni dans les meilleurs délais.',
        'En cas d\'impossibilité de remplacement, un avoir ou une prolongation de durée équivalente sera accordé.',
      ])}
      ${info(`Pour bénéficier de la garantie, le Client doit contacter le support par email : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a> en précisant son numéro de commande et la nature du dysfonctionnement.`)}
      <p style="margin-top:14px;">La garantie ne s'applique pas en cas de manquement aux obligations du Client (modification du mot de passe, partage non autorisé, etc.).</p>
    `,
  },
  {
    title: 'Obligations du client',
    content: `
      <p>Le Client s'engage à :</p>
      ${ul([
        'Ne pas modifier le mot de passe du compte maître ou les paramètres du compte partagé,',
        'Utiliser exclusivement le profil qui lui a été attribué,',
        'Ne pas partager ses identifiants avec des tiers non autorisés,',
        'Ne pas tenter d\'identifier ou de contacter les autres utilisateurs du compte,',
        'Ne pas utiliser le service à des fins illégales ou contraires aux conditions d\'utilisation des plateformes concernées.',
      ])}
      <p style="margin-top:12px;">Tout manquement à ces obligations entraînera la résiliation immédiate du service sans remboursement ni compensation.</p>
    `,
  },
  {
    title: 'Plateformes tierces',
    content: `
      <p>StreamMalin ${strong('ne pourra être tenu responsable')} des événements suivants, décidés unilatéralement par les plateformes tierces :</p>
      ${ul([
        'Modification des conditions d\'utilisation ou de la politique de partage de compte,',
        'Restrictions géographiques ou limitations de contenus,',
        'Fermeture ou suspension de comptes par YouTube, Disney+, ou toute autre plateforme,',
        'Interruptions techniques, maintenances ou indisponibilités des services tiers.',
      ])}
      <p style="margin-top:12px;">Dans ces situations, StreamMalin s'efforcera de proposer une solution alternative (remplacement de compte, report de durée) dans la mesure du possible, sans obligation de remboursement.</p>
    `,
  },
  {
    title: 'Support client',
    content: `
      <p>Le support StreamMalin est joignable par email :</p>
      ${info(`<strong style="color:var(--text)">Email : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a></strong><br/>Disponible 7j/7. Merci de préciser votre numéro de commande et votre email lors du premier contact.`)}
      <p style="margin-top:12px;">Délai de réponse : sous 24 heures en jours ouvrés.</p>
    `,
  },
  {
    title: "Impayés, opposition bancaire et litiges de paiement",
    content: `
      ${warn(`<strong style="color:#ff3b3b;">Tout litige ouvert sur Stripe ou PayPal (chargeback, contestation de paiement, demande de remboursement) sans contact préalable avec le support StreamMalin entraînera la clôture immédiate et définitive de l'accès concerné, sans compensation ni remboursement d'aucune sorte.</strong>`)}
      <p style="margin-top:14px;">Procédure obligatoire en cas de problème :</p>
      ${ul([
        `Contacter le support par email avant toute démarche : <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a>`,
        `Attendre la réponse de l'équipe (sous 24h maximum).`,
        `Si aucune solution n'est trouvée, les voies légales et la médiation restent ouvertes.`,
      ])}
    `,
  },
  {
    title: 'Responsabilité',
    content: `
      <p>StreamMalin s'engage à mettre en œuvre tous les moyens raisonnables pour assurer la disponibilité et la qualité du service. Cependant, StreamMalin ne saurait être tenu responsable :</p>
      ${ul([
        'Des interruptions de service dues aux plateformes tierces,',
        'Des dommages indirects, pertes de données ou manque à gagner,',
        'Des problèmes liés à la connexion Internet du Client,',
        'De l\'utilisation du service par un tiers non autorisé ayant eu accès aux identifiants du Client.',
      ])}
      <p style="margin-top:12px;">La responsabilité de StreamMalin, si elle venait à être engagée, est limitée au montant payé par le Client pour la commande concernée.</p>
    `,
  },
  {
    title: 'Données personnelles',
    content: `
      <p>StreamMalin collecte et traite les données personnelles du Client (email, adresse Gmail si nécessaire, informations de paiement) dans le cadre de l'exécution du contrat et conformément au RGPD.</p>
      <p style="margin-top:10px;">Responsable du traitement : SAID OUARZOZI EI — <a href="mailto:hello@streammalin.fr" style="color:#60a5fa;">hello@streammalin.fr</a></p>
      <p style="margin-top:10px;">Le Client dispose d'un droit d'accès, de rectification, de suppression et d'opposition sur ses données. Pour en savoir plus, consultez notre <a href="/politique-confidentialite" style="color:#60a5fa;">Politique de confidentialité</a>.</p>
    `,
  },
  {
    title: 'Médiation de la consommation',
    content: `
      <p>Conformément aux articles L612-1 et suivants du Code de la consommation, le Client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige.</p>
      <p style="margin-top:10px;">Le médiateur compétent pour StreamMalin est actuellement ${strong('en cours de désignation')}. Cette section sera mise à jour dès la désignation effectuée.</p>
      <p style="margin-top:10px;">En attendant, tout litige peut être soumis à la plateforme européenne de règlement en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;">https://ec.europa.eu/consumers/odr</a></p>
    `,
  },
  {
    title: 'Droit applicable et litiges',
    content: `
      <p>Les présentes CGV sont soumises au droit français. En cas de litige, le Client est invité à contacter en priorité le support StreamMalin pour une résolution amiable.</p>
      <p style="margin-top:10px;">À défaut de résolution amiable dans un délai raisonnable, les tribunaux compétents sont ceux du ressort du siège social de SAID OUARZAZI EI (Tribunal judiciaire d'Auxerre ou tribunal compétent selon la nature du litige).</p>
    `,
  },
  {
    title: 'Modification des CGV',
    content: `
      <p>StreamMalin se réserve le droit de modifier les présentes CGV à tout moment. Les nouvelles conditions sont applicables dès leur publication sur le site. Pour les commandes en cours, les CGV en vigueur au moment de la commande continuent de s'appliquer.</p>
      <p style="margin-top:10px;">Il appartient au Client de consulter régulièrement cette page. La date de dernière mise à jour est indiquée en haut de ce document.</p>
    `,
  },
];
