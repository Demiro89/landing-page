import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Mentions Légales — StreamMalin',
  description: 'Mentions légales du site streammalin.fr — SAID OUARZAZI EI.',
};

export default function MentionsLegalesPage() {
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
            fontFamily: 'var(--font-syne), sans-serif',
            fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '8px',
          }}
        >
          Mentions Légales
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Conformément aux articles 6-III et 19 de la loi n°2004-575 du 21 juin 2004 pour la
          Confiance dans l&apos;Économie Numérique (LCEN).
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            color: 'var(--muted)',
            fontSize: '0.9rem',
            lineHeight: 1.85,
          }}
        >
          {/* 1. Éditeur */}
          <section>
            <SectionTitle n={1}>Éditeur du site</SectionTitle>
            <p>
              Le site <strong style={{ color: 'var(--text)' }}>streammalin.fr</strong> est édité par :
            </p>
            <Table
              rows={[
                ['Forme juridique', 'Entrepreneur individuel (EI)'],
                ['Nom', 'SAID OUARZAZI'],
                ['Nom commercial', 'StreamMalin'],
                ['Adresse professionnelle', '4 rue des Acacias, 89200 Avallon, France'],
                ['SIREN', 'en cours d\'attribution'],
                ['SIRET', 'en cours d\'attribution'],
                ['Email', 'hello@streammalin.fr'],
                ['Téléphone', '06 99 11 10 23'],
                ['Directeur de la publication', 'SAID OUARZAZI'],
              ]}
            />
          </section>

          {/* 2. Hébergeur */}
          <section>
            <SectionTitle n={2}>Hébergement</SectionTitle>
            <p>Le site est hébergé par :</p>
            <Table
              rows={[
                ['Société', 'Vercel Inc.'],
                ['Adresse', '340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis'],
                ['Site internet', 'https://vercel.com'],
                ['Contact', 'https://vercel.com/contact'],
                ['Email support', 'support@vercel.com'],
                ['Téléphone', 'Non disponible publiquement'],
              ]}
            />
          </section>

          {/* 3. Non-affiliation */}
          <section>
            <SectionTitle n={3}>Indépendance et non-affiliation</SectionTitle>
            <div
              style={{
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '9px',
                padding: '14px 16px',
                fontSize: '0.86rem',
                color: '#60a5fa',
                lineHeight: 1.7,
              }}
            >
              StreamMalin n&apos;est pas affilié aux plateformes YouTube, Google, Disney+,
              Surfshark, PayPal, Stripe ou à tout autre service mentionné sur ce site. Ces noms
              sont des marques déposées appartenant à leurs propriétaires respectifs. StreamMalin
              agit en qualité de prestataire de services numériques indépendant, facilitant l'accès à certains abonnements numériques.
              L&apos;accès aux services peut dépendre des règles techniques et contractuelles
              imposées par ces plateformes.
            </div>
          </section>

          {/* 4. Propriété intellectuelle */}
          <section>
            <SectionTitle n={4}>Propriété intellectuelle</SectionTitle>
            <p>
              L&apos;ensemble du contenu de ce site (textes, graphismes, logo, structure) est la
              propriété de StreamMalin — SAID OUARZAZI EI, sauf mentions contraires. Toute
              reproduction, représentation ou exploitation non autorisée est strictement interdite.
            </p>
          </section>

          {/* 5. Données personnelles */}
          <section>
            <SectionTitle n={5}>Protection des données personnelles</SectionTitle>
            <p>
              Les données collectées (email, adresse Gmail si nécessaire, informations de paiement)
              sont utilisées exclusivement pour la gestion des commandes et la livraison des
              services. Elles ne sont pas cédées à des tiers à des fins commerciales.
            </p>
            <p style={{ marginTop: '10px' }}>
              Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d&apos;un
              droit d&apos;accès, de rectification, de suppression et d&apos;opposition sur vos
              données. Pour exercer ces droits :{' '}
              <a href="mailto:hello@streammalin.fr" style={{ color: '#60a5fa' }}>
                hello@streammalin.fr
              </a>
            </p>
            <p style={{ marginTop: '10px' }}>
              Pour plus d&apos;informations, consultez notre{' '}
              <a href="/politique-confidentialite" style={{ color: '#60a5fa' }}>
                Politique de confidentialité
              </a>
              .
            </p>
          </section>

          {/* 6. Cookies */}
          <section>
            <SectionTitle n={6}>Cookies</SectionTitle>
            <p>
              Le site utilise uniquement des cookies strictement nécessaires à son fonctionnement
              (session, authentification). Aucun cookie publicitaire n&apos;est déposé. Pour plus
              d&apos;informations, consultez notre{' '}
              <a href="/politique-confidentialite" style={{ color: '#60a5fa' }}>
                Politique de confidentialité
              </a>
              .
            </p>
          </section>

          {/* 7. Médiation */}
          <section>
            <SectionTitle n={7}>Médiation de la consommation</SectionTitle>
            <p>
              Conformément aux articles L612-1 et suivants du Code de la consommation, un
              dispositif de médiation de la consommation sera mis en place. Le médiateur
              compétent est actuellement{' '}
              <strong style={{ color: 'var(--text)' }}>en cours de désignation</strong>. Cette
              page sera mise à jour dès la désignation effectuée.
            </p>
          </section>

          {/* 8. Droit applicable */}
          <section>
            <SectionTitle n={8}>Droit applicable</SectionTitle>
            <p>
              Le présent site et ses mentions légales sont soumis au droit français. En cas de
              litige, et à défaut de résolution amiable, les tribunaux français seront seuls
              compétents.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-syne), sans-serif',
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
        {n}
      </span>
      {children}
    </h2>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '12px',
        fontSize: '0.86rem',
      }}
    >
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
            <td
              style={{
                padding: '9px 14px 9px 0',
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                verticalAlign: 'top',
                width: '40%',
              }}
            >
              {label}
            </td>
            <td
              style={{
                padding: '9px 0',
                color: 'var(--text)',
                fontWeight: 500,
                verticalAlign: 'top',
              }}
            >
              {value.startsWith('http') ? (
                <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                  {value}
                </a>
              ) : value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
