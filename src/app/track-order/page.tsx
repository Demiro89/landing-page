'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type Order = {
  id: string;
  service: 'YOUTUBE' | 'DISNEY';
  status: string;
  amount: number;
  paymentMethod: string;
  gmail: string | null;
  invitationSentAt: string | null;
  createdAt: string;
  expiresAt: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PAYMENT_DECLARED: { label: 'Paiement déclaré',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: 'fa-clock' },
  PENDING:          { label: 'En attente',           color: '#8888aa', bg: 'rgba(136,136,170,0.1)', icon: 'fa-hourglass-half' },
  CONFIRMED:        { label: 'Confirmé',             color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: 'fa-circle-check' },
  ACTIVE:           { label: 'Actif',                color: '#00ffaa', bg: 'rgba(0,255,170,0.1)',   icon: 'fa-bolt' },
  EXPIRED:          { label: 'Expiré',               color: '#ff3b3b', bg: 'rgba(255,59,59,0.1)',   icon: 'fa-circle-xmark' },
  CANCELLED:        { label: 'Annulé',               color: '#ff3b3b', bg: 'rgba(255,59,59,0.1)',   icon: 'fa-ban' },
};

const METHOD_LABELS: Record<string, string> = {
  PAYPAL:     'PayPal',
  SOL:        'Solana',
  XRP:        'XRP',
  USDT_TRC20: 'USDT TRC-20',
  STRIPE:     'Carte / Apple Pay',
};

// Inner component — uses useSearchParams(), must be inside <Suspense>
function TrackOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill email from URL param or localStorage
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail) {
      setEmail(urlEmail);
      // Auto-search if email comes from URL
      handleSearch(urlEmail);
    } else {
      try {
        const stored = localStorage.getItem('sm_last_order');
        if (stored) {
          const { email: storedEmail } = JSON.parse(stored);
          if (storedEmail) setEmail(storedEmail);
        }
      } catch {
        // ignore
      }
    }
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(emailToSearch?: string) {
    const target = (emailToSearch ?? email).toLowerCase().trim();
    setError('');
    if (!target.includes('@')) {
      setError('Veuillez saisir une adresse email valide.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/track-order?email=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur serveur.');
      setOrders(data.orders ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function daysLeft(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', padding: '100px 24px 80px', maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '999px', padding: '6px 16px', fontSize: '0.72rem',
            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            color: 'var(--green)', marginBottom: '20px',
          }}>
            <i className="fa-solid fa-magnifying-glass" />
            Suivi de commande
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
            fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px',
          }}>
            Retrouvez vos commandes
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Entrez votre email pour voir le statut de vos abonnements.
          </p>
        </div>

        {/* Search form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '24px', marginBottom: '28px',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            Votre adresse email
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@email.com"
                required
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border2)', borderRadius: '9px',
                  padding: '11px 14px', fontSize: '0.88rem', color: 'var(--text)',
                  outline: 'none', fontFamily: 'DM Sans, sans-serif',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                  color: '#fff', border: 'none', borderRadius: '9px',
                  padding: '11px 20px', fontFamily: 'Syne, sans-serif',
                  fontWeight: 700, fontSize: '0.88rem', cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' as const,
                }}
              >
                {loading
                  ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />Recherche...</>
                  : <><i className="fa-solid fa-magnifying-glass" style={{ marginRight: '6px' }} />Rechercher</>
                }
              </button>
            </div>
          </label>

          {error && (
            <div style={{
              marginTop: '12px', background: 'rgba(255,59,59,0.08)',
              border: '1px solid rgba(255,59,59,0.25)', borderRadius: '8px',
              padding: '10px 14px', fontSize: '0.82rem', color: '#ff6b6b',
            }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
              {error}
            </div>
          )}
        </form>

        {/* Results */}
        {searched && !loading && (
          orders.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 24px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px',
            }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: '2rem', color: 'var(--muted)', marginBottom: '12px', display: 'block' }} />
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                Aucune commande trouvée pour cet email.
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                Vérifiez l'adresse saisie ou <a href="/#offres" style={{ color: '#3b82f6' }}>passez une commande</a>.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>
                {orders.length} commande{orders.length > 1 ? 's' : ''} trouvée{orders.length > 1 ? 's' : ''}
              </p>
              {orders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['PENDING'];
                const isActive = order.status === 'ACTIVE';
                const days = order.expiresAt ? daysLeft(order.expiresAt) : null;
                const urgent = days !== null && days <= 3;

                return (
                  <div
                    key={order.id}
                    style={{
                      background: 'var(--card)',
                      border: `1px solid ${isActive ? 'rgba(0,255,170,0.2)' : 'var(--border)'}`,
                      borderRadius: '14px', padding: '18px 20px',
                      transition: 'transform 0.2s',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = '')}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap' as const, gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                          background: order.service === 'YOUTUBE' ? 'rgba(255,59,59,0.15)' : 'rgba(124,58,237,0.15)',
                          color: order.service === 'YOUTUBE' ? 'var(--yt)' : '#a78bfa',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
                        }}>
                          <i className={order.service === 'YOUTUBE' ? 'fa-brands fa-youtube' : 'fa-solid fa-wand-magic-sparkles'} />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.92rem' }}>
                            {order.service === 'YOUTUBE' ? 'YouTube Premium' : 'Disney+ 4K'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                            #{order.id.slice(0, 12).toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: cfg.bg, color: cfg.color,
                        border: `1px solid ${cfg.color}30`,
                        borderRadius: '999px', padding: '4px 10px',
                        fontSize: '0.74rem', fontWeight: 700,
                      }}>
                        <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: '0.65rem' }} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Details row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '16px', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '14px' }}>
                      <span><i className="fa-solid fa-calendar" style={{ marginRight: '5px' }} />Commandé le {formatDate(order.createdAt)}</span>
                      <span><i className="fa-solid fa-euro-sign" style={{ marginRight: '5px' }} />{order.amount.toFixed(2).replace('.', ',')}€/mois</span>
                      <span><i className="fa-solid fa-credit-card" style={{ marginRight: '5px' }} />{METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</span>
                    </div>

                    {/* YouTube invitation status */}
                    {order.service === 'YOUTUBE' && isActive && (
                      <div style={{
                        background: order.invitationSentAt ? 'rgba(0,255,170,0.05)' : 'rgba(245,158,11,0.05)',
                        border: `1px solid ${order.invitationSentAt ? 'rgba(0,255,170,0.2)' : 'rgba(245,158,11,0.2)'}`,
                        borderRadius: '8px', padding: '10px 14px',
                        marginBottom: '10px',
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem',
                      }}>
                        {order.invitationSentAt ? (
                          <>
                            <i className="fa-solid fa-circle-check" style={{ color: '#00ffaa', flexShrink: 0 }} />
                            <span>
                              <span style={{ color: '#00ffaa', fontWeight: 600 }}>
                                L&apos;invitation a été envoyée sur votre adresse Gmail !
                              </span>
                              {' '}
                              <span style={{ color: 'var(--muted)' }}>Vérifiez vos spams.</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-clock" style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span style={{ color: '#f59e0b' }}>
                              En attente de l&apos;envoi de l&apos;invitation YouTube Premium
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Expiry bar */}
                    {isActive && order.expiresAt && (
                      <div style={{
                        background: urgent ? 'rgba(255,59,59,0.06)' : 'rgba(0,255,170,0.04)',
                        border: `1px solid ${urgent ? 'rgba(255,59,59,0.2)' : 'rgba(0,255,170,0.15)'}`,
                        borderRadius: '8px', padding: '8px 12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '14px', flexWrap: 'wrap' as const, gap: '6px',
                      }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          <i className="fa-solid fa-clock" style={{ marginRight: '5px' }} />
                          Expire le {formatDate(order.expiresAt)}
                        </span>
                        <span style={{
                          fontSize: '0.74rem', fontWeight: 700,
                          color: urgent ? '#ff6b6b' : 'var(--green)',
                        }}>
                          {days !== null && days > 0 ? `J-${days}` : 'Expiré'}
                        </span>
                      </div>
                    )}

                    {/* CTA */}
                    <button
                      onClick={() => router.push(`/dashboard?orderId=${order.id}&email=${encodeURIComponent(email)}`)}
                      style={{
                        width: '100%', padding: '10px', borderRadius: '9px',
                        border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.03)',
                        color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                        transition: 'background 0.2s, color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                      }}
                    >
                      <i className="fa-solid fa-gauge-high" style={{ marginRight: '7px' }} />
                      Voir le détail dans mon espace client
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Telegram support */}
        <div style={{
          marginTop: '32px', textAlign: 'center',
          padding: '20px', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: '14px',
        }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '12px' }}>
            Un problème avec votre commande ?
          </p>
          <a
            href="https://t.me/flexnight9493"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)',
              color: '#3b82f6', borderRadius: '10px', padding: '10px 20px',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            <i className="fa-brands fa-telegram" />
            Contacter le support Telegram
          </a>
        </div>

      </main>
      <Footer />
    </>
  );
}

// Default export — wraps content in Suspense (required by Next.js 14 for useSearchParams)
export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--muted)' }} />
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}
