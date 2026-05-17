'use client';

export default function Footer() {
  return (
    <footer style={{ position: 'relative', zIndex: 1 }}>
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '40px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            fontFamily: 'var(--font-syne), sans-serif',
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

        {/* Navigation links */}
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
            { href: '/mentions-legales', label: 'Mentions légales' },
            { href: '/politique-confidentialite', label: 'Politique de confidentialité' },
            { href: 'mailto:hello@streammalin.fr', label: '✉ hello@streammalin.fr', external: true },
            { href: 'https://t.me/flexnight9493', label: '📩 Support Telegram', external: true },
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

        {/* Non-affiliation */}
        <p
          style={{
            fontSize: '0.73rem',
            color: 'var(--muted)',
            maxWidth: '620px',
            lineHeight: 1.6,
            opacity: 0.7,
          }}
        >
          StreamMalin n&apos;est pas affilié aux plateformes YouTube, Google, Disney+, Surfshark
          ou autres services mentionnés. L&apos;accès peut dépendre des règles techniques et
          contractuelles imposées par ces plateformes.
        </p>

        {/* EI info */}
        <p style={{ fontSize: '0.73rem', color: 'var(--muted)', opacity: 0.6 }}>
          SAID OUARZAZI EI — Entrepreneur individuel — SIREN : en cours d&apos;attribution
          &nbsp;·&nbsp; 4 rue des Acacias, 89200 Avallon, France
        </p>

        <p style={{ fontSize: '0.73rem', color: 'var(--muted)', opacity: 0.6, marginTop: '-8px' }}>
          © {new Date().getFullYear()} StreamMalin. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
