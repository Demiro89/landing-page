'use client';

type Service = 'YOUTUBE' | 'DISNEY';

export default function Navbar({
  onSubscribe,
}: {
  onSubscribe?: (service: Service) => void;
}) {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(10,10,15,0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 20px',
          height: '62px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: '1rem',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              width: '30px',
              height: '30px',
              background: '#fff',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontSize: '0.8rem',
            }}
          >
            <i className="fa-solid fa-bolt" />
          </span>
          StreamMalin
        </a>

        {/* Links */}
        <div
          className="hidden sm:flex"
          style={{
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {[
            { href: '#offres', label: 'Offres' },
            { href: '#comment', label: 'Comment ça marche' },
            { href: '#avis', label: 'Avis' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: 'var(--muted)',
                fontSize: '0.85rem',
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

        {/* CTA Button */}
        <button
          onClick={() => onSubscribe?.('YOUTUBE')}
          style={{
            background: '#fff',
            color: '#000',
            fontWeight: 700,
            fontSize: '0.82rem',
            padding: '8px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            border: 'none',
            transition: 'opacity 0.2s',
            fontFamily: 'Syne, sans-serif',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          <i className="fa-solid fa-bolt" style={{ marginRight: '6px' }} />
          S'abonner
        </button>
      </div>
    </nav>
  );
}
