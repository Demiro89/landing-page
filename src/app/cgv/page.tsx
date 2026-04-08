import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales de Vente — StreamMalin',
  description: 'Conditions générales de vente applicables aux services d\'abonnement StreamMalin.',
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
          Retour à l'accueil
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
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Dernière mise à jour : 8 avril 2026
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Vendeur : StreamMalin — <a href="mailto:contact@streammalin.fr" style={{ color: 'var(--muted)' }}>contact@streammalin.fr</a>
        </p>

        {/* Critical notice */}
        <div style={{
          background: 'rgba(255,59,59,0.06)',
          border: '1px solid rgba(255,59,59,0.25)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '40px',
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start',
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ff3b3b', fontSize: '1rem', marginTop: '3px', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#ff6b6b', lineHeight: 1.7 }}>
            <strong style={{ color: '#ff3b3b' }}>Important :</strong> En passant commande sur StreamMalin, vous acceptez l'intégralité des présentes CGV, notamment l'absence de droit de rétractation sur les produits numériques livrés immédiatement, et la politique de résiliation immédiate en cas de litige PayPal ou Stripe non précédé d'un contact support.
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
            <section key={i} style={{
              borderBottom: i < sections.length - 1 ? '1px solid var(--border)' : 'none',
              paddingBottom: i < sections.length - 1 ? '36px' : '0',
            }}>
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
                <span style={{
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
                }}>
                  {i + 1}
                </span>
                {section.title}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: section.content }} />
            </section>
          ))}
        </div>

        {/* Support CTA */}
        <div style={{
          marginTop: '48px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '24px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '14px' }}>
            Une question sur ces conditions ? Contactez notre support.
          </p>
          <a
            href="https://t.me/flexnight9493"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)',
              color: '#3b82f6', borderRadius: '10px', padding: '10px 20px',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
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

const ul = (items: string[]) =>
  `<ul style="padding-left:18px;margin-top:10px;display:flex;flex-direction:column;gap:7px;">${items.map((li) => `<li>${li}</li>`).join('')}</ul>`;

const strong = (text: string) => `<strong style="color:var(--text)">${text}</strong>`;

const warn = (html: string) =>
  `<div style="background:rgba(255,59,59,0.06);border:1px solid rgba(255,59,59,0.2);border-radius:9px;padding:14px 16px;margin-top:14px;font-size:0.86rem;color:#ff6b6b;line-height:1.7;">${html}</div>`;

const info = (html: string) =>
  `<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:9px;padding:14px 16px;margin-top:14px;font-size:0.86rem;color:#60a5fa;line-height:1.7;">${html}</div>`;

const sections = [
  {
    title: 'Nature du service',
    content: `
      <p>StreamMalin est une plateforme de co-abonnement qui fournit des ${strong('services d\'accès à des contenus numériques')} sous forme d'abonnements à des plateformes de streaming.</p>
      <p style="margin-top:10px;">Les services proposés sont :</p>
      ${ul([
        `${strong('YouTube Premium Famille')} — Accès via invitation sur votre compte Google/Gmail.`,
        `${strong('Disney+ 4K')} — Attribution d'un profil dédié sur un compte Premium.`,
      ])}
      <p style="margin-top:12px;">StreamMalin agit en qualité de revendeur de places sur des abonnements familiaux ou partagés autorisés par les plateformes concernées.</p>
    `,
  },
  {
    title: 'Commande et paiement',
    content: `
      <p>La commande est considérée comme ferme et définitive dès sa validation et la déclaration du paiement. Les moyens de paiement acceptés sont :</p>
      ${ul([
        'Carte bancaire, Apple Pay, Google Pay (via Stripe — activation immédiate)',
        'PayPal — envoi "Entre proches" uniquement, sans note ni libellé',
        'Cryptomonnaies : Solana (SOL) réseau Solana, XRP réseau Ripple, USDT réseau TRC-20/TRON',
      ])}
      <p style="margin-top:12px;">Pour les paiements crypto, le client est seul responsable du choix du réseau. Tout envoi sur un réseau incorrect entraînera la perte définitive des fonds, StreamMalin ne pouvant en aucun cas les récupérer.</p>
    `,
  },
  {
    title: 'Livraison et activation',
    content: `
      <p>Les accès sont livrés par voie électronique :</p>
      ${ul([
        `${strong('Stripe')} : activation immédiate et automatique après confirmation du paiement.`,
        `${strong('PayPal / Crypto')} : activation sous 1 à 24 heures après vérification manuelle du paiement.`,
      ])}
      <p style="margin-top:12px;">Les identifiants et accès sont transmis par email et disponibles dans l'espace client. StreamMalin ne peut être tenu responsable d'un délai supplémentaire lié à une indisponibilité temporaire des plateformes.</p>
    `,
  },
  {
    title: 'Absence de droit de rétractation — Non-remboursement',
    content: `
      ${warn(`<strong style="color:#ff3b3b;">Aucun remboursement ne sera effectué une fois les identifiants ou l'invitation envoyés.</strong>`)}
      <p style="margin-top:14px;">Conformément à l'${strong('article L221-28 du Code de la consommation')}, le droit de rétractation de 14 jours ne s'applique pas aux :</p>
      ${ul([
        'Contenus numériques dont l\'exécution a commencé avec l\'accord exprès du consommateur,',
        'Services pleinement exécutés avant la fin du délai de rétractation.',
      ])}
      <p style="margin-top:12px;">En passant commande sur StreamMalin, le client reconnaît expressément renoncer à son droit de rétractation dès la livraison des accès, et accepte que le service soit considéré comme pleinement exécuté à ce stade.</p>
    `,
  },
  {
    title: 'Garantie et remplacement',
    content: `
      <p>StreamMalin s'engage à fournir un accès fonctionnel pendant toute la durée de l'abonnement souscrit. En cas de dysfonctionnement technique imputable à StreamMalin (compte désactivé, identifiants invalides, profil inaccessible), le client bénéficie d'une ${strong('garantie de remplacement')} :</p>
      ${ul([
        'Un accès de substitution équivalent sera fourni dans les meilleurs délais.',
        'En cas d\'impossibilité de remplacement, un avoir ou une prolongation de durée équivalente sera accordé.',
      ])}
      ${info(`Pour bénéficier de la garantie, le client doit impérativement contacter le support via <strong style="color:#f0f0f5;">Telegram : <a href="https://t.me/flexnight9493" style="color:#60a5fa;">t.me/flexnight9493</a></strong> en précisant son numéro de commande et la nature du dysfonctionnement.`)}
      <p style="margin-top:14px;">La garantie ne s'applique pas en cas de manquement aux obligations du client (modification du mot de passe, partage non autorisé, etc.).</p>
    `,
  },
  {
    title: 'Responsabilité limitée — Plateformes tierces',
    content: `
      <p>StreamMalin ${strong('ne pourra être tenu responsable')} des événements suivants, décidés unilatéralement par les plateformes tierces :</p>
      ${ul([
        'Modification des conditions d\'utilisation ou de la politique de partage de compte,',
        'Restrictions géographiques ou limitations de contenus,',
        'Fermeture ou suspension de comptes par Netflix, Disney+, YouTube ou toute autre plateforme,',
        'Interruptions techniques, maintenances ou indisponibilités des services tiers.',
      ])}
      <p style="margin-top:12px;">Dans ces situations, StreamMalin s'efforcera de proposer une solution alternative (remplacement de compte, report de durée) dans la mesure du possible, sans obligation de remboursement.</p>
    `,
  },
  {
    title: 'Obligations du client',
    content: `
      <p>Le client s'engage à :</p>
      ${ul([
        'Ne pas modifier le mot de passe du compte maître ou les paramètres du compte partagé,',
        'Utiliser exclusivement le profil qui lui a été attribué,',
        'Ne pas partager ses identifiants avec des tiers non autorisés,',
        'Ne pas tenter d\'identifier ou de contacter les autres utilisateurs du compte.',
      ])}
      <p style="margin-top:12px;">Tout manquement à ces obligations entraînera la résiliation immédiate du service sans remboursement ni compensation.</p>
    `,
  },
  {
    title: 'Litiges — Politique de contestation',
    content: `
      ${warn(`<strong style="color:#ff3b3b;">Tout litige ouvert sur Stripe ou PayPal (chargeback, contestation de paiement) sans contact préalable avec notre support Telegram entraînera la clôture immédiate et définitive de l'accès, sans compensation ni remboursement.</strong>`)}
      <p style="margin-top:14px;">En cas de problème, le client doit impérativement contacter le support en premier lieu :</p>
      ${ul([
        `Telegram : <a href="https://t.me/flexnight9493" style="color:#60a5fa;">t.me/flexnight9493</a>`,
        `Email : <a href="mailto:contact@streammalin.fr" style="color:#60a5fa;">contact@streammalin.fr</a>`,
      ])}
      <p style="margin-top:12px;">Les présentes CGV sont soumises au droit français. En cas de litige persistant, les tribunaux compétents sont ceux du ressort du siège social du Vendeur.</p>
    `,
  },
  {
    title: 'Durée et renouvellement',
    content: `
      <p>Les abonnements sont souscrits pour une durée choisie par le client (1, 3, 6 ou 12 mois), à compter de la date d'activation. ${strong('Le renouvellement n\'est pas automatique.')} Le client doit initier une nouvelle commande avant l'expiration pour assurer la continuité du service.</p>
      <p style="margin-top:10px;">La date d'expiration est visible dans l'espace client et communiquée par email.</p>
    `,
  },
  {
    title: 'Modification des CGV',
    content: `
      <p>StreamMalin se réserve le droit de modifier les présentes CGV à tout moment. Les nouvelles conditions sont applicables dès leur publication sur le site. Pour les commandes en cours, les CGV en vigueur au moment de la commande continuent de s'appliquer.</p>
    `,
  },
];
