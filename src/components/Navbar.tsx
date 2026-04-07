'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Service = 'YOUTUBE' | 'DISNEY';

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

  // Lire le localStorage côté client uniquement
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sm_last_order');
      if (stored) {
        const parsed: StoredOrder = JSON.parse(stored);
        // Ne montrer que les commandes des 31 derniers jours
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

  const serviceColor = lastOrder?.service === 'YOUTUBE' ? 'var(--yt)' : '#a78bfa';

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(10,10,15,0.85)',
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
            fontFamily: 'Syne, sans-serif',
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

        {/* Links — hidden on mobile */}
        <div
          className="hidden sm:flex"
          style={{ alignItems: 'center', gap: '24px' }}
        >
          {[
            { href: '/#offres',  label: 'Offres' },
            { href: '/#comment', label: 'Comment ça marche' },
            { href: '/#avis',    label: 'Avis' },
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
            // Client has a recent order → "Ma commande en cours" pill
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
                fontFamily: 'Syne, sans-serif',
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
            // No stored order → plain "Suivre" link
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
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '0.75rem' }} />
              Suivre ma commande
            </Link>
          )}

          {/* Subscribe CTA */}
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
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.opacity = '1')
            }
          >
            <i className="fa-solid fa-bolt" style={{ marginRight: '6px' }} />
            S'abonner
          </button>
        </div>
      </div>
    </nav>
  );
}
