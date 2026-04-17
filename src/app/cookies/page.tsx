import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Politique Cookies — StreamMalin',
  description: 'Gestion des cookies et traceurs sur StreamMalin.',
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

type CookieRow = { name: string; purpose: string; duration: string; type: string };

const CookieTable = ({ rows }: { rows: CookieRow[] }) => (
  <div style={{ overflowX: 'auto', marginTop: '12px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border2)' }}>
          {['Nom', 'Finalité', 'Durée', 'Type'].map((h) => (
            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text)', fontFamily: 'Syne, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#a78bfa', whiteSpace: 'nowrap' }}>{r.name}</td>
            <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.purpose}</td>
            <td style={{ padding: '8px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.duration}</td>
            <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function CookiesPage() {
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
            Politique Cookies
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Dernière mise à jour : avril 2025 — streammalin.fr
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <Section title="Qu'est-ce qu'un cookie ?">
            <p>
              Un cookie est un petit fichier texte déposé sur votre appareil lors de votre visite.
              Il permet de mémoriser des préférences ou de mesurer l&apos;audience du site.
              Aucun cookie ne permet de vous identifier personnellement sans votre consentement.
            </p>
          </Section>

          <Section title="Cookies strictement nécessaires">
            <p>Ces cookies sont indispensables au fonctionnement du site. Ils ne peuvent pas être refusés.</p>
            <CookieTable rows={[
              { name: 'sm_admin_auth', purpose: 'Authentification admin', duration: 'Session', type: 'Technique' },
              { name: 'sm_beta_access', purpose: 'Accès bêta privé validé', duration: '30 jours', type: 'Technique' },
              { name: 'sm-theme', purpose: 'Mémorisation du thème clair/sombre', duration: 'Permanent', type: 'Préférence' },
              { name: 'sm_last_order', purpose: 'Accès rapide à votre dernière commande (localStorage)', duration: '31 jours', type: 'Fonctionnel' },
            ]} />
          </Section>

          <Section title="Cookies analytiques">
            <p>
              Nous utilisons Google Analytics pour mesurer l&apos;audience de façon anonymisée.
              Ces cookies sont soumis à votre consentement.
            </p>
            <CookieTable rows={[
              { name: '_ga', purpose: 'Identifiant visiteur Google Analytics', duration: '2 ans', type: 'Analytique' },
              { name: '_ga_*', purpose: 'Session Google Analytics', duration: '2 ans', type: 'Analytique' },
            ]} />
            <p style={{ marginTop: '12px' }}>
              Pour désactiver Google Analytics :{' '}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                Google Analytics Opt-out Add-on
              </a>.
            </p>
          </Section>

          <Section title="Cookies de paiement (tiers)">
            <p>
              Stripe et PayPal peuvent déposer leurs propres cookies lors du processus de paiement.
              Ces cookies sont régis par leurs politiques de confidentialité respectives :
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li><a href="https://stripe.com/fr/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>Stripe Privacy Policy</a></li>
              <li><a href="https://www.paypal.com/fr/webapps/mpp/ua/privacy-full" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>PayPal Politique de confidentialité</a></li>
            </ul>
          </Section>

          <Section title="Comment gérer vos cookies ?">
            <p>
              Vous pouvez configurer votre navigateur pour refuser tout ou partie des cookies.
              Attention : désactiver les cookies techniques peut altérer le fonctionnement du site.
            </p>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li><strong style={{ color: 'var(--text)' }}>Chrome</strong> : Paramètres → Confidentialité → Cookies</li>
              <li><strong style={{ color: 'var(--text)' }}>Firefox</strong> : Paramètres → Vie privée → Cookies</li>
              <li><strong style={{ color: 'var(--text)' }}>Safari</strong> : Préférences → Confidentialité</li>
            </ul>
            <p style={{ marginTop: '12px' }}>
              Pour toute question : <strong style={{ color: 'var(--text)' }}>contact@streammalin.fr</strong>
            </p>
          </Section>

        </div>
      </main>
      <Footer />
    </>
  );
}
