import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Conditions Générales de Vente — StreamMalin',
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
          padding: '90px 24px 60px',
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
            transition: 'color 0.2s',
          }}
        >
          <i className="fa-solid fa-arrow-left" style={{ fontSize: '0.75rem' }} />
          Retour à l'accueil
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
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            color: 'var(--muted)',
            fontSize: '0.9rem',
            lineHeight: 1.8,
          }}
        >
          {sections.map((section, i) => (
            <section key={i}>
              <h2
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '12px',
                }}
              >
                Article {i + 1} — {section.title}
              </h2>
              <div dangerouslySetInnerHTML={{ __html: section.content }} />
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

const sections = [
  {
    title: 'Objet',
    content: `<p>Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre StreamMalin (ci-après "le Vendeur") et toute personne physique ou morale souhaitant procéder à un achat via le site streammalin.fr.</p>`,
  },
  {
    title: 'Description des services',
    content: `<p>StreamMalin propose des accès partagés à des abonnements premium de streaming :</p>
    <ul style="padding-left:20px;margin-top:8px;display:flex;flex-direction:column;gap:6px;">
      <li><strong style="color:var(--text)">YouTube Premium</strong> — 5,99€/mois : Accès à un compte familial YouTube Premium (invitation envoyée sur votre adresse Gmail).</li>
      <li><strong style="color:var(--text)">Disney+ 4K</strong> — 4,99€/mois : Attribution d'un profil personnel sur un compte Disney+ Premium.</li>
    </ul>
    <p style="margin-top:12px;">Ces services sont des accès légaux à des abonnements familiaux/partagés proposés par les plateformes concernées.</p>`,
  },
  {
    title: 'Commande et paiement',
    content: `<p>La commande est réputée ferme et définitive lors de la déclaration de paiement par le client. Les méthodes de paiement acceptées sont :</p>
    <ul style="padding-left:20px;margin-top:8px;display:flex;flex-direction:column;gap:6px;">
      <li>PayPal (envoi entre proches, sans libellé)</li>
      <li>Cryptomonnaies : Solana (SOL), XRP, USDT TRC-20</li>
    </ul>
    <p style="margin-top:12px;">Le paiement doit être effectué au montant exact indiqué. Tout paiement incomplet pourra entraîner un retard dans l'activation du service.</p>`,
  },
  {
    title: 'Livraison et activation',
    content: `<p>Après vérification du paiement (généralement sous 1 heure) :</p>
    <ul style="padding-left:20px;margin-top:8px;display:flex;flex-direction:column;gap:6px;">
      <li><strong style="color:var(--text)">Disney+</strong> : Les identifiants (email, mot de passe, numéro de profil, code PIN) sont affichés dans votre espace client.</li>
      <li><strong style="color:var(--text)">YouTube Premium</strong> : Une invitation est envoyée sur votre adresse Gmail dans les 24h suivant la confirmation.</li>
    </ul>`,
  },
  {
    title: 'Durée et renouvellement',
    content: `<p>Les abonnements sont proposés au mois. La durée est de 31 jours à compter de l'activation. Le renouvellement n'est pas automatique : le client doit initier une nouvelle commande avant l'expiration pour continuer à bénéficier du service.</p>`,
  },
  {
    title: 'Droit de rétractation',
    content: `<p>Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux contenus numériques dont l'exécution a commencé avec l'accord préalable exprès du consommateur. En acceptant nos CGV et en demandant l'activation immédiate, vous renoncez à votre droit de rétractation.</p>`,
  },
  {
    title: 'Obligations du client',
    content: `<p>Le client s'engage à :</p>
    <ul style="padding-left:20px;margin-top:8px;display:flex;flex-direction:column;gap:6px;">
      <li>Ne pas modifier le mot de passe du compte maître</li>
      <li>Ne pas partager ses accès avec des tiers</li>
      <li>Utiliser un seul profil sur les comptes partagés</li>
      <li>Ne pas chercher à identifier d'autres utilisateurs du compte</li>
    </ul>
    <p style="margin-top:12px;">Tout manquement à ces obligations pourra entraîner la résiliation immédiate du service sans remboursement.</p>`,
  },
  {
    title: 'Responsabilité',
    content: `<p>StreamMalin ne peut être tenu responsable des interruptions de service liées aux plateformes tierces (YouTube, Disney+), ni des modifications des politiques de partage de ces plateformes. En cas d'indisponibilité prolongée du service imputable à StreamMalin, un avoir ou un remboursement au prorata sera proposé.</p>`,
  },
  {
    title: 'Litiges',
    content: `<p>En cas de litige, le client peut contacter notre support via Telegram (@abonnementpro_bot). Les présentes CGV sont soumises au droit français. En cas de litige persistant, les tribunaux compétents sont ceux du ressort du siège du Vendeur.</p>`,
  },
];
