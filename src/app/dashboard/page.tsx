'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// --------------------------------------
// Types
// --------------------------------------
type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_DECLARED'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED';

interface DisneyAccess {
  masterEmail: string;
  masterPassword: string;
  profileNumber: number;
  pinCode?: string;
}

interface OrderData {
  id: string;
  service: 'YOUTUBE' | 'DISNEY';
  status: OrderStatus;
  amount: number;
  paymentMethod: string;
  paymentTxId?: string;
  gmail?: string;
  createdAt: string;
  expiresAt?: string;
  disneyAccess?: DisneyAccess;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: string; desc: string }
> = {
  PENDING: {
    label: 'En attente',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    icon: 'fa-clock',
    desc: 'Votre commande est créée. En attente de votre déclaration de paiement.',
  },
  PAYMENT_DECLARED: {
    label: 'Paiement déclaré',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    icon: 'fa-hourglass-half',
    desc: 'Paiement déclaré. Vérification en cours par notre équipe (généralement < 1h).',
  },
  CONFIRMED: {
    label: 'Confirmé',
    color: 'var(--green)',
    bg: 'rgba(0,255,170,0.1)',
    icon: 'fa-circle-check',
    desc: 'Paiement confirmé ! Vos accès sont en cours de traitement.',
  },
  ACTIVE: {
    label: 'Actif',
    color: 'var(--green)',
    bg: 'rgba(0,255,170,0.1)',
    icon: 'fa-play-circle',
    desc: 'Votre abonnement est actif. Profitez-en !',
  },
  EXPIRED: {
    label: 'Expiré',
    color: 'var(--muted)',
    bg: 'rgba(136,136,170,0.1)',
    icon: 'fa-calendar-xmark',
    desc: 'Cet abonnement a expiré. Renouvelez-le pour continuer à profiter du service.',
  },
  CANCELLED: {
    label: 'Annulé',
    color: 'var(--yt)',
    bg: 'rgba(255,59,59,0.1)',
    icon: 'fa-circle-xmark',
    desc: 'Cette commande a été annulée.',
  },
};

// --------------------------------------
// Dashboard Page
// --------------------------------------
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardLoading() {
  return (
    <>
      <Navbar />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 24px',
        }}
      >
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '16px', display: 'block' }} />
          Chargement...
        </div>
      </main>
      <Footer />
    </>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const emailParam = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailParam);
  const [inputEmail, setInputEmail] = useState(emailParam);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gmailInputs, setGmailInputs] = useState<Record<string, string>>({});
  const [gmailSaving, setGmailSaving] = useState<Record<string, boolean>>({});
  const [gmailSaved, setGmailSaved] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState('');

  const fetchOrders = async (emailToFetch: string) => {
    if (!emailToFetch) return;
    setLoading(true);
    setError('');

    try {
      const url = `/api/dashboard?email=${encodeURIComponent(emailToFetch)}${orderId ? `&orderId=${orderId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Erreur lors du chargement.');
      }

      setOrders(data.orders ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (emailParam) fetchOrders(emailParam);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setEmail(inputEmail);
    fetchOrders(inputEmail);
  };

  const handleSaveGmail = async (oId: string) => {
    const gmail = gmailInputs[oId];
    if (!gmail?.includes('@')) return;
    setGmailSaving((p) => ({ ...p, [oId]: true }));

    try {
      const res = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: oId, gmail }),
      });
      if (!res.ok) throw new Error();
      setGmailSaved((p) => ({ ...p, [oId]: true }));
      // Refresh orders
      await fetchOrders(email);
    } catch {
      // silent
    } finally {
      setGmailSaving((p) => ({ ...p, [oId]: false }));
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    });
  };

  return (
    <>
      <Navbar />
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          maxWidth: '800px',
          margin: '0 auto',
          padding: '90px 24px 60px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '36px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0,255,170,0.08)',
              border: '1px solid rgba(0,255,170,0.2)',
              borderRadius: '999px',
              padding: '5px 14px',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--green)',
              marginBottom: '16px',
            }}
          >
            <i className="fa-solid fa-gauge-high" />
            Espace Client
          </div>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '8px',
            }}
          >
            Mes abonnements
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
            Consultez vos accès et le statut de vos commandes.
          </p>
        </div>

        {/* Email lookup form */}
        <form
          onSubmit={handleSearch}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '32px',
          }}
        >
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            Votre adresse email
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border2)',
                  borderRadius: '9px',
                  padding: '11px 14px',
                  fontSize: '0.88rem',
                  color: 'var(--text)',
                  outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  color: '#fff',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '11px 20px',
                  borderRadius: '9px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  <>
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '6px' }} />
                    Rechercher
                  </>
                )}
              </button>
            </div>
          </label>
        </form>

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(255,59,59,0.08)',
              border: '1px solid rgba(255,59,59,0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '0.85rem',
              color: 'var(--yt)',
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }} />
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && email && orders.length === 0 && !error && (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: 'var(--muted)',
            }}
          >
            <i
              className="fa-regular fa-folder-open"
              style={{ fontSize: '2.5rem', marginBottom: '16px', display: 'block' }}
            />
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>Aucune commande trouvée</p>
            <p style={{ fontSize: '0.85rem' }}>
              Vérifiez l'adresse email utilisée lors de votre commande.
            </p>
          </div>
        )}

        {/* Orders list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              gmailInput={gmailInputs[order.id] ?? ''}
              onGmailChange={(val) =>
                setGmailInputs((p) => ({ ...p, [order.id]: val }))
              }
              onGmailSave={() => handleSaveGmail(order.id)}
              gmailSaving={gmailSaving[order.id] ?? false}
              gmailSaved={gmailSaved[order.id] ?? false}
              copiedKey={copiedKey}
              onCopy={copyText}
            />
          ))}
        </div>

        {/* Support */}
        <div
          style={{
            marginTop: '40px',
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(59,130,246,0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            <i className="fa-brands fa-telegram" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '0.92rem',
                marginBottom: '2px',
              }}
            >
              Besoin d'aide ?
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              Notre support répond 7j/7 sur Telegram.
            </div>
          </div>
          <a
            href="https://t.me/flexnight9493"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#3b82f6',
              color: '#fff',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '9px 16px',
              borderRadius: '8px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Contacter le support
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}

// --------------------------------------
// Order Card
// --------------------------------------
function OrderCard({
  order,
  gmailInput,
  onGmailChange,
  onGmailSave,
  gmailSaving,
  gmailSaved,
  copiedKey,
  onCopy,
}: {
  order: OrderData;
  gmailInput: string;
  onGmailChange: (val: string) => void;
  onGmailSave: () => void;
  gmailSaving: boolean;
  gmailSaved: boolean;
  copiedKey: string;
  onCopy: (text: string, key: string) => void;
}) {
  const config = STATUS_CONFIG[order.status];
  const isYoutube = order.service === 'YOUTUBE';
  const isActive = order.status === 'ACTIVE' || order.status === 'CONFIRMED';

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: isYoutube ? 'rgba(255,59,59,0.15)' : 'rgba(124,58,237,0.15)',
              color: isYoutube ? 'var(--yt)' : '#a78bfa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            <i className={isYoutube ? 'fa-brands fa-youtube' : 'fa-solid fa-wand-magic-sparkles'} />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '0.92rem',
              }}
            >
              {isYoutube ? 'YouTube Premium' : 'Disney+ 4K'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {order.amount.toFixed(2).replace('.', ',')}€/mois ·{' '}
              #{order.id.slice(0, 10).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: config.bg,
            border: `1px solid ${config.color}40`,
            borderRadius: '999px',
            padding: '5px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: config.color,
            fontFamily: 'Syne, sans-serif',
          }}
        >
          <i className={`fa-solid ${config.icon}`} />
          {config.label}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '18px 20px' }}>
        {/* Status description */}
        <p
          style={{
            fontSize: '0.83rem',
            color: 'var(--muted)',
            marginBottom: '16px',
            lineHeight: 1.5,
          }}
        >
          {config.desc}
        </p>

        {/* -- DISNEY+ ACCESS -- */}
        {!isYoutube && order.disneyAccess && isActive && (
          <div
            style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
            }}
          >
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: '#a78bfa',
                marginBottom: '12px',
              }}
            >
              <i className="fa-solid fa-key" style={{ marginRight: '6px' }} />
              Vos accès Disney+
            </p>

            {[
              { label: 'Email', value: order.disneyAccess.masterEmail, key: `email-${order.id}` },
              { label: 'Mot de passe', value: order.disneyAccess.masterPassword, key: `pass-${order.id}` },
              { label: 'N° de profil', value: `Profil ${order.disneyAccess.profileNumber}`, key: null },
              ...(order.disneyAccess.pinCode
                ? [{ label: 'Code PIN', value: order.disneyAccess.pinCode, key: `pin-${order.id}` }]
                : []),
            ].map((field, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '8px 0',
                  borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '2px' }}>
                    {field.label}
                  </div>
                  <code
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--text)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {field.value}
                  </code>
                </div>
                {field.key && (
                  <button
                    onClick={() => onCopy(field.value, field.key!)}
                    className={`copy-btn ${copiedKey === field.key ? 'copied' : ''}`}
                    style={{ flexShrink: 0 }}
                  >
                    {copiedKey === field.key ? (
                      <><i className="fa-solid fa-check" /> Copié</>
                    ) : (
                      <><i className="fa-regular fa-copy" /> Copier</>
                    )}
                  </button>
                )}
              </div>
            ))}

            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'rgba(0,255,170,0.05)',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: 'var(--muted)',
              }}
            >
              <i className="fa-solid fa-circle-info" style={{ marginRight: '6px', color: 'var(--green)' }} />
              Connectez-vous sur{' '}
              <a
                href="https://disneyplus.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--green)' }}
              >
                disneyplus.com
              </a>{' '}
              et utilisez <strong>Profil {order.disneyAccess.profileNumber}</strong>. Ne changez pas
              le mot de passe.
            </div>
          </div>
        )}

        {/* -- YOUTUBE — Gmail form -- */}
        {isYoutube && isActive && !order.gmail && (
          <div
            style={{
              background: 'rgba(255,59,59,0.06)',
              border: '1px solid rgba(255,59,59,0.2)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
            }}
          >
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: 'var(--yt)',
                marginBottom: '8px',
              }}
            >
              <i className="fa-brands fa-google" style={{ marginRight: '6px' }} />
              Renseignez votre Gmail
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '12px' }}>
              Pour recevoir l'invitation YouTube Premium sur votre compte Google.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                value={gmailInput}
                onChange={(e) => onGmailChange(e.target.value)}
                placeholder="votre-gmail@gmail.com"
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border2)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '0.85rem',
                  color: 'var(--text)',
                  outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
              <button
                onClick={onGmailSave}
                disabled={gmailSaving || !gmailInput.includes('@')}
                style={{
                  background: 'var(--yt)',
                  color: '#fff',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: gmailSaving ? 'not-allowed' : 'pointer',
                  opacity: gmailSaving ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {gmailSaving ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  'Envoyer'
                )}
              </button>
            </div>
          </div>
        )}

        {/* YouTube — Gmail confirmed */}
        {isYoutube && order.gmail && (
          <div
            style={{
              background: 'rgba(255,59,59,0.06)',
              border: '1px solid rgba(255,59,59,0.2)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '12px',
            }}
          >
            <p
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: 'var(--yt)',
                marginBottom: '6px',
              }}
            >
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }} />
              Gmail enregistré
            </p>
            <code style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{order.gmail}</code>
            {isActive && (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '6px' }}>
                L'invitation YouTube Premium a été envoyée sur cette adresse. Acceptez-la depuis
                votre boîte Gmail.
              </p>
            )}
          </div>
        )}

        {/* Expiration */}
        {order.expiresAt && isActive && (
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              marginTop: '4px',
            }}
          >
            <i className="fa-regular fa-calendar" style={{ marginRight: '6px' }} />
            Expire le{' '}
            {new Date(order.expiresAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        )}

        {/* Renew button for expired */}
        {order.status === 'EXPIRED' && (
          <a
            href="/#offres"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '12px',
              background: isYoutube ? 'var(--yt)' : 'linear-gradient(135deg,#2563eb,#7c3aed)',
              color: '#fff',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '9px 16px',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            <i className="fa-solid fa-rotate-right" />
            Renouveler
          </a>
        )}
      </div>
    </div>
  );
}
