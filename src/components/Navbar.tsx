'use client';

import Icon from './Icon';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Service = 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';

type StoredOrder = {
  orderId: string;
  email: string;
  service: Service;
  createdAt: string;
};

export default function Navbar({
  onSubscribe,
}: {
  onSubscribe?: (service: Service) => void;
}) {
  const [lastOrder, setLastOrder] = useState<StoredOrder | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sm_last_order');
      if (stored) {
        const parsed: StoredOrder = JSON.parse(stored);
        const age = Date.now() - new Date(parsed.createdAt).getTime();
        if (age < 31 * 24 * 60 * 60 * 1000) {
          setLastOrder(parsed);
        } else {
          localStorage.removeItem('sm_last_order');
        }
      }
    } catch {
      // ignoré
    }
  }, []);

  const trackUrl = lastOrder
    ? `/track-order?email=${encodeURIComponent(lastOrder.email)}`
    : '/track-order';

  const serviceColor =
    lastOrder?.service === 'YOUTUBE'
      ? 'var(--yt)'
      : lastOrder?.service === 'SURFSHARK'
      ? 'var(--surf)'
      : '#a78bfa';

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
      }}
    >
      {/* Gradient accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, hsl(262,85%,62%), hsl(190,95%,50%), transparent)',
          opacity: 0.5,
        }}
      />

      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 20px',
          height: '62px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
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
            fontSize: '1rem',
            color: 'var(--text)',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: '30px',
              height: '30px',
              background: 'var(--gradient-primary)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '0.8rem',
              boxShadow: '0 0 12px rgba(138,92,247,0.4)',
            }}
          >
            <Icon className="fa-solid fa-bolt" />
          </span>
          <span className="gradient-text">StreamMalin</span>
        </a>

        {/* Links — hidden on mobile */}
        <div
          className="hidden sm:flex"
          style={{ alignItems: 'center', gap: '24px' }}
        >
          {[
            { href: '/#offres', label: 'Offres' },
            { href: '/#comment', label: 'Comment ça marche' },
            { href: '/#avis', label: 'Avis' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: 'var(--muted)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
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

        {/* Right side buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

          {/* Dynamic order button */}
          {lastOrder ? (
            <Link
              href={trackUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: `${serviceColor}15`,
                border: `1px solid ${serviceColor}40`,
                color: serviceColor,
                borderRadius: '999px',
                padding: '6px 13px',
                fontSize: '0.78rem',
                fontWeight: 700,
                textDecoration: 'none',
                fontFamily: 'var(--font-syne), sans-serif',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.background = `${serviceColor}25`)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.background = `${serviceColor}15`)
              }
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: serviceColor,
                  boxShadow: `0 0 6px ${serviceColor}`,
                  animation: 'blink 1.8s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
              Ma commande
            </Link>
          ) : (
            <Link
              href="/track-order"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--muted)',
                fontSize: '0.82rem',
                textDecoration: 'none',
                padding: '6px 10px',
                borderRadius: '8px',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)')
              }
            >
              <Icon className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.75rem' }} />
              Suivre ma commande
            </Link>
          )}

          {/* Subscribe CTA */}
          <button
            onClick={() => onSubscribe?.('YOUTUBE')}
            style={{
              background: 'var(--gradient-primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '8px 18px',
              borderRadius: '8px',
              cursor: 'pointer',
              border: 'none',
              transition: 'opacity 0.2s, transform 0.2s',
              fontFamily: 'var(--font-syne), sans-serif',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(138,92,247,0.35)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            <Icon className="fa-solid fa-bolt" style={{ marginRight: '6px' }} />
            S&apos;abonner
          </button>
        </div>
      </div>
    </nav>
  );
}
