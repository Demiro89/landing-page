import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Politique de Confidentialité — StreamMalin',
  description: 'Politique de confidentialité et traitement des données personnelles de StreamMalin.',
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>
      {title}
    </h2>
    <div style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.8 }}>
      {children}
    </div>
  </section>
);

export default function PolitiqueConfidentialitePage() {
  return (
    <>
      <Navbar />
      <main style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', padding: '90px 24px 60px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--muted)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '32px' }}>
          <i className="fa-solid fa-arrow-left" style={{ fontSize: '0.75rem' }} />
          Retour à l&apos;accueil
        </a>

        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Politique de Confidentialité
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Dernière mise à jour : avril 2025 — Applicable à streammalin.fr
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <Section title="1. Responsable du traitement">
            <p>
              StreamMalin est exploité par un particulier agissant à titre personnel (sans SIRET).
              Pour toute question relative à vos données, contactez-nous à&nbsp;:
              <strong style={{ color: 'var(--text)' }}> contact@streammalin.fr</strong> ou via Telegram&nbsp;
              <strong style={{ color: 'var(--text)' }}>@streammalin_support</strong>.
            </p>
          </Section>

          <Section title="2. Données collectées">
            <p>Nous collectons uniquement les données nécessaires à la fourniture du service :</p>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li><strong style={{ color: 'var(--text)' }}>Adresse email</strong> — identification, envoi des accès, support.</li>
              <li><strong style={{ color: 'var(--text)' }}>Adresse Gmail</strong> — pour les abonnements YouTube Premium (envoi de l&apos;invitation).</li>
              <li><strong style={{ color: 'var(--text)' }}>Données de paiement</strong> — traitées par Stripe ou PayPal. Nous ne stockons aucun numéro de carte.</li>
              <li><strong style={{ color: 'var(--text)' }}>Données de navigation</strong> — via Google Analytics (anonymisées, sans cookie de tracking si refusé).</li>
            </ul>
          </Section>

          <Section title="3. Base légale du traitement">
            <p>
              Les traitements reposent sur l&apos;exécution du contrat (art. 6.1.b RGPD) pour les données
              liées aux commandes, et sur votre consentement (art. 6.1.a RGPD) pour l&apos;analytique et
              les communications marketing.
            </p>
          </Section>

          <Section title="4. Durée de conservation">
            <ul style={{ paddingLeft: '20px' }}>
              <li>Données de commande : <strong style={{ color: 'var(--text)' }}>5 ans</strong> à compter de la fin de l&apos;abonnement (obligation légale).</li>
              <li>Email liste d&apos;attente : jusqu&apos;à désinscription ou <strong style={{ color: 'var(--text)' }}>2 ans</strong> sans activité.</li>
              <li>Logs techniques : <strong style={{ color: 'var(--text)' }}>30 jours</strong>.</li>
            </ul>
          </Section>

          <Section title="5. Partage des données">
            <p>
              Vos données ne sont jamais vendues. Elles peuvent être transmises à nos sous-traitants
              techniques uniquement :
            </p>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li><strong style={{ color: 'var(--text)' }}>Stripe</strong> — traitement des paiements par carte (États-Unis, clauses contractuelles types).</li>
              <li><strong style={{ color: 'var(--text)' }}>PayPal</strong> — traitement des paiements PayPal.</li>
              <li><strong style={{ color: 'var(--text)' }}>Vercel</strong> — hébergement de l&apos;application (États-Unis, Data Processing Agreement).</li>
              <li><strong style={{ color: 'var(--text)' }}>Neon / Resend</strong> — base de données et emails transactionnels.</li>
              <li><strong style={{ color: 'var(--text)' }}>Google Analytics</strong> — analyse d&apos;audience anonymisée.</li>
            </ul>
          </Section>

          <Section title="6. Vos droits">
            <p>
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Droit d&apos;accès, de rectification et d&apos;effacement de vos données.</li>
              <li>Droit à la portabilité et à la limitation du traitement.</li>
              <li>Droit d&apos;opposition aux traitements basés sur l&apos;intérêt légitime.</li>
              <li>Droit de retirer votre consentement à tout moment.</li>
            </ul>
            <p style={{ marginTop: '10px' }}>
              Pour exercer ces droits : <strong style={{ color: 'var(--text)' }}>contact@streammalin.fr</strong>.
              Réponse sous 30 jours. Vous pouvez également déposer une réclamation auprès de la
              <strong style={{ color: 'var(--text)' }}> CNIL</strong> (cnil.fr).
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              Nous utilisons des cookies techniques (session, thème, accès bêta) et analytiques
              (Google Analytics). Pour en savoir plus, consultez notre{' '}
              <a href="/cookies" style={{ color: '#3b82f6', textDecoration: 'none' }}>politique cookies</a>.
            </p>
          </Section>

          <Section title="8. Sécurité">
            <p>
              Les données sont stockées sur des serveurs sécurisés (Neon/Vercel). Les accès
              sont protégés par chiffrement HTTPS/TLS. Les mots de passe ne sont jamais stockés
              en clair. Les paiements sont intégralement délégués à Stripe et PayPal (PCI-DSS).
            </p>
          </Section>

        </div>
      </main>
      <Footer />
    </>
  );
}
