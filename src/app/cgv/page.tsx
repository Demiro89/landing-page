// 📄 FILE: src/app/cgv/page.tsx

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Conditions Générales de Vente — StreamMalin',
  description: "Conditions générales de vente applicables au service de facilitation de partage de frais StreamMalin.",
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
        {/* Back */}
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

        {/* Header */}
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
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
          Dernière mise à jour : 18 avril 2026
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Contact :{' '}
          <a href="mailto:hello@streammalin.fr" style={{ color: 'var(--muted)' }}>
            hello@streammalin.fr
          </a>
        </p>

        {/* Critical notice */}
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
            <strong style={{ color: '#ff3b3b' }}>Important :</strong> En utilisant StreamMalin,
            vous acceptez l&apos;intégralité des présentes CGV, notamment l&apos;exclusion du droit de
            rétractation dès la fourniture des accès, et la résiliation immédiate en cas de litige
            Stripe/PayPal ouvert sans contact préalable avec le support Telegram.
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
            href="https://t.me/flexnight9493"
            target="_blank"
            rel="noopener noreferrer"
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
            <i className="fa-brands fa-telegram" />
            Support Telegram
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const ul = (items: string[]) =>
  `<ul style="padding-left:18px;margin-top:10px;display:flex;flex-direction:column;gap:7px;">${items.map((li) => `<li>${li}</li>`).join('')}</ul>`;

const s = (text: string) => `<strong style="color:var(--text)">${text}</strong>`;

const warn = (html: string) =>
  `<div style="background:rgba(255,59,59,0.06);border:1px solid rgba(255,59,59,0.2);border-left:3px solid #ff3b3b;border-radius:9px;padding:14px 16px;margin-top:14px;font-size:0.86rem;color:#ff6b6b;line-height:1.7;">${html}</div>`;

const info = (html: string) =>
  `<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:9px;padding:14px 16px;margin-top:14px;font-size:0.86rem;color:#60a5fa;line-height:1.7;">${html}</div>`;

const tg = `<a href="https://t.me/flexnight9493" style="color:#60a5fa;">t.me/flexnight9493</a>`;

/* ─── Sections ───────────────────────────────────────────────────── */

const sections = [
  {
    title: 'Statut et nature de l\'activité',
    content: `
      <p>StreamMalin est un service de ${s('gestion et de facilitation de partage de frais')} pour abonnements de streaming familiaux, exercé à titre non professionnel conformément à l'${s('article L110-1 du Code de Commerce')}.</p>
      <p style="margin-top:10px;">L'organisateur mutualise des accès familiaux acquis légalement auprès des plateformes concernées (YouTube, Disney+, etc.) afin de réduire les coûts individuels des participants. Il ne s'agit pas d'une revente de contenus protégés mais d'une répartition des frais d'un abonnement familial entre ses membres.</p>
      ${info(`Ce service est exercé à titre non commercial. Il ne constitue pas une activité commerciale au sens de l'article L110-1 du Code de Commerce.`)}
    `,
  },
  {
    title: 'Services proposés',
    content: `
      <p>Les participations aux frais proposées sont :</p>
      ${ul([
        `${s('YouTube Premium Famille')} — Accès via invitation Google sur votre adresse Gmail.`,
        `${s('Disney+ Premium 4K')} — Attribution d'un profil dédié sur un abonnement familial.`,
        `${s('Surfshark VPN One')} — Accès partagé sur un abonnement multi-appareils.`,
      ])}
      <p style="margin-top:12px;">Chaque accès est personnel, non cessible, et strictement limité à l'usage individuel du participant.</p>
    `,
  },
  {
    title: 'Participation aux frais et paiement',
    content: `
      <p>La participation est considérée comme confirmée dès la validation du paiement. Les modes de règlement acceptés sont :</p>
      ${ul([
        `${s('Carte bancaire, Apple Pay, Google Pay')} — via Stripe. Activation immédiate et automatique.`,
        `${s('PayPal')} — envoi "Entre proches" uniquement, sans note ni libellé commercial, au montant exact indiqué.`,
        `${s('Cryptomonnaies')} — Solana (SOL · réseau Solana), XRP (réseau Ripple), USDT (réseau TRC-20/TRON uniquement).`,
      ])}
      <p style="margin-top:14px;font-size:0.88rem;">Le libellé apparaissant sur votre relevé bancaire lors d'un paiement Stripe sera : <strong style="color:var(--text);font-family:monospace;letter-spacing:0.05em;">STREAMMALIN</strong>.</p>
      ${warn(`<strong style="color:#ff3b3b;">⚠️ RÉSEAUX CRYPTO — ERREURS IRRÉVERSIBLES</strong><br/><br/>
        Vous devez impérativement utiliser le réseau exact indiqué : <strong style="color:#f0f0f5;">réseau Solana</strong> pour SOL, <strong style="color:#f0f0f5;">réseau Ripple</strong> pour XRP, <strong style="color:#f0f0f5;">réseau TRC-20</strong> pour USDT.<br/><br/>
        Tout envoi sur un mauvais réseau ou vers une adresse incorrecte entraîne la <strong style="color:#ff3b3b;">perte définitive et irréversible des fonds</strong>. Les transactions blockchain ne peuvent pas être annulées ou remboursées. <strong>Aucun recours n'est possible dans ce cas.</strong>`)}
    `,
  },
  {
    title: 'Livraison et activation',
    content: `
      <p>Les accès sont transmis par voie électronique, selon le mode de paiement choisi :</p>
      ${ul([
        `${s('Stripe (CB / Apple Pay / Google Pay)')} : activation <strong style="color:var(--text)">immédiate et automatique</strong> dès confirmation du paiement.`,
        `${s('PayPal / Cryptomonnaies')} : activation sous <strong style="color:var(--text)">1 à 24 heures</strong> après vérification manuelle par l'équipe StreamMalin.`,
      ])}
      <p style="margin-top:12px;">Les identifiants ou invitations sont transmis par email à l'adresse fournie lors de la commande, et disponibles dans l'espace client. StreamMalin ne peut être tenu responsable des délais liés à une indisponibilité temporaire des plateformes tierces.</p>
    `,
  },
  {
    title: 'Garantie de continuité de service',
    content: `
      <p>StreamMalin s'engage à fournir un accès fonctionnel pendant toute la durée de la participation souscrite.</p>
      <p style="margin-top:10px;">${s('En cas de mise à jour des conditions d\'une plateforme tierce')} (YouTube, Disney+, Surfshark, etc.) impactant la possibilité de partage familial, StreamMalin s'engage à :</p>
      ${ul([
        `Fournir un ${s('compte de substitution équivalent')} dans un délai de <strong style="color:var(--text)">24 heures</strong>,`,
        `Ou, en cas d'impossibilité technique avérée, accorder un ${s('avoir au prorata temporis')} de la durée restante.`,
      ])}
      ${info(`En cas de dysfonctionnement, contactez le support via ${tg} en précisant votre numéro de commande. La garantie ne s'applique pas aux manquements du participant (modification de paramètres, partage avec des tiers, etc.).`)}
    `,
  },
  {
    title: 'Exclusion du droit de rétractation',
    content: `
      ${warn(`<strong style="color:#ff3b3b;">Le droit de rétractation de 14 jours est exclu dès la fourniture des accès.</strong>`)}
      <p style="margin-top:14px;">Conformément à l'${s('article L221-28 13° du Code de la consommation')}, le droit de rétractation ne s'applique pas aux contenus numériques et services dont l'exécution a commencé avec l'accord exprès du participant avant l'expiration du délai légal.</p>
      <p style="margin-top:10px;">En validant sa commande, le participant reconnaît expressément :</p>
      ${ul([
        'Avoir été informé de l\'exclusion du droit de rétractation,',
        'Consentir au début immédiat de l\'exécution du service,',
        'Renoncer au droit de rétractation dès réception des accès.',
      ])}
      <p style="margin-top:12px;font-size:0.88rem;color:var(--muted);">Aucun remboursement ne sera effectué une fois les identifiants ou l'invitation envoyés.</p>
    `,
  },
  {
    title: 'Obligations du participant',
    content: `
      <p>Le participant s'engage à :</p>
      ${ul([
        'Ne pas modifier le mot de passe du compte maître ni les paramètres de l\'abonnement,',
        'Utiliser exclusivement le profil ou l\'accès qui lui a été attribué,',
        'Ne pas partager ses identifiants avec des tiers non autorisés,',
        'Ne pas tenter d\'identifier ou de contacter les autres membres du groupe,',
        'Respecter les conditions d\'utilisation de la plateforme tierce concernée.',
      ])}
      <p style="margin-top:12px;">Tout manquement entraîne la résiliation immédiate du service sans remboursement ni compensation.</p>
    `,
  },
  {
    title: 'Responsabilité limitée — Plateformes tierces',
    content: `
      <p>StreamMalin ${s('ne peut être tenu responsable')} des décisions unilatérales des plateformes tierces, notamment :</p>
      ${ul([
        'Modification de leurs conditions de partage ou d\'utilisation,',
        'Restrictions géographiques ou de contenus,',
        'Suspension ou fermeture de comptes décidée par la plateforme,',
        'Interruptions techniques ou maintenances non planifiées.',
      ])}
      <p style="margin-top:12px;">Dans ces situations, StreamMalin appliquera sa garantie de continuité (Art. 5) dans la mesure du possible.</p>
    `,
  },
  {
    title: 'Support — Canal officiel exclusif',
    content: `
      <p>Le ${s('seul canal de support officiel')} de StreamMalin est Telegram. Toute demande (problème d'accès, question sur une commande, signalement) doit être adressée exclusivement via :</p>
      ${info(`<strong style="color:#f0f0f5;">Telegram : ${tg}</strong><br/>Disponible 7j/7. Merci de préciser votre numéro de commande et votre email lors du premier contact.`)}
      <p style="margin-top:12px;">Les demandes adressées via d'autres canaux (email non officiel, réseaux sociaux, etc.) ne peuvent pas être traitées et n'engagent pas StreamMalin.</p>
    `,
  },
  {
    title: 'Litiges — Procédure obligatoire',
    content: `
      ${warn(`<strong style="color:#ff3b3b;">Tout chargeback, litige ou contestation de paiement ouvert sur Stripe ou PayPal sans contact préalable avec le support Telegram entraîne la clôture immédiate et définitive de l'accès concerné, sans compensation ni remboursement d'aucune sorte.</strong>`)}
      <p style="margin-top:14px;">Procédure obligatoire avant toute démarche :</p>
      ${ul([
        `Contacter le support Telegram en priorité : ${tg}`,
        `Attendre une réponse de l'équipe (délai maximum : 24 heures).`,
        `Si aucune solution n'est trouvée à l'amiable, les voies légales restent ouvertes.`,
      ])}
      <p style="margin-top:12px;">Les présentes CGV sont soumises au droit français. En cas de litige persistant non résolu à l'amiable, les parties s'engagent à rechercher une solution par médiation avant tout recours judiciaire.</p>
    `,
  },
  {
    title: 'Durée et renouvellement',
    content: `
      <p>Les participations sont proposées pour les durées suivantes : ${s('1 mois, 3 mois, 6 mois ou 12 mois')}, à compter de la date d'activation de l'accès.</p>
      <p style="margin-top:10px;">${s('Le renouvellement n\'est pas automatique.')} Le participant doit initier une nouvelle commande avant la date d'expiration pour assurer la continuité du service. La date d'expiration est visible dans l'espace client et communiquée par email.</p>
    `,
  },
  {
    title: 'Modification des CGV',
    content: `
      <p>StreamMalin se réserve le droit de modifier les présentes CGV à tout moment. Les nouvelles conditions sont applicables dès leur publication sur le site. Pour les commandes en cours, les CGV en vigueur au moment de la commande continuent de s'appliquer jusqu'à leur échéance.</p>
    `,
  },
];
