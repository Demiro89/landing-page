'use client';

export default function Footer() {
  return (
    <footer style={{ position: 'relative', zIndex: 1 }}>
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'center',
        }}
      >
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: '0.95rem',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              width: '28px',
              height: '28px',
              background: '#fff',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontSize: '0.75rem',
            }}
          >
            <i className="fa-solid fa-bolt" />
          </span>
          StreamMalin
        </a>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          {[
            { href: '#offres', label: 'Nos offres' },
            { href: '#comment', label: 'Comment ça marche' },
            { href: '#avis', label: 'Avis clients' },
            { href: '/cgv', label: 'CGV' },
            { href: '/mentions-legales', label: 'Mentions Légales' },
            { href: 'https://t.me/abonnementpro_bot', label: '📩 Support Telegram', external: true },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              style={{
                color: 'var(--muted)',
                fontSize: '0.8rem',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)')
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          Support 7j/7 — réponse en moins d'une heure.
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          Ce service propose des accès partagés à des abonnements familiaux. Résiliation à tout
          moment.
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
          © {new Date().getFullYear()} StreamMalin. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
