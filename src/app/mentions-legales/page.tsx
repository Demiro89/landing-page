import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Mentions Légales — StreamMalin',
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
          Mentions Légales
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '40px' }}>
          Conformément aux articles 6-III et 19 de la Loi n°2004-575 du 21 juin 2004 pour la Confiance dans l'Économie Numérique.
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
          <section>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            >
              1. Éditeur du site
            </h2>
            <p>
              Le site streammalin.fr est édité à titre personnel.<br />
              Contact : via Telegram @abonnementpro_bot<br />
              Email : disponible sur demande via le support.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            >
              2. Hébergement
            </h2>
            <p>
              Le site est hébergé par :<br />
              <strong style={{ color: 'var(--text)' }}>Vercel Inc.</strong><br />
              340 Pine Street, Suite 1109<br />
              San Francisco, CA 94104, USA<br />
              <a href="https://vercel.com" style={{ color: 'var(--green)' }}>vercel.com</a>
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            >
              3. Propriété intellectuelle
            </h2>
            <p>
              L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes) est la propriété exclusive de StreamMalin, sauf mentions contraires. Toute reproduction, représentation, modification ou exploitation non autorisée est strictement interdite.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            >
              4. Protection des données personnelles (RGPD)
            </h2>
            <p>
              Les données collectées (email, adresse Gmail) sont utilisées uniquement pour la gestion des commandes et la livraison des services. Elles ne sont pas cédées à des tiers.
            </p>
            <p style={{ marginTop: '8px' }}>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez des droits suivants :
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement ("droit à l'oubli")</li>
              <li>Droit à la portabilité</li>
              <li>Droit d'opposition au traitement</li>
            </ul>
            <p style={{ marginTop: '8px' }}>
              Pour exercer ces droits, contactez-nous via Telegram @abonnementpro_bot.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            >
              5. Cookies
            </h2>
            <p>
              Ce site utilise Google Analytics et le pixel TikTok à des fins de mesure d'audience. Ces outils déposent des cookies de mesure d'audience. Vous pouvez refuser ces cookies en configurant votre navigateur.
            </p>
          </section>

          <section>
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '12px',
              }}
            >
              6. Droit applicable
            </h2>
            <p>
              Le présent site et ses mentions légales sont soumis au droit français. En cas de litige, les tribunaux français seront seuls compétents.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
