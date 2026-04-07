'use client';

import { useState, useEffect, useCallback } from 'react';

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────
interface Order {
  id: string;
  service: 'YOUTUBE' | 'DISNEY';
  status: string;
  amount: number;
  paymentMethod: string;
  paymentTxId?: string;
  gmail?: string;
  createdAt: string;
  user: { email: string };
  slot?: {
    profileNumber: number;
    pinCode?: string;
    masterAccount: { email: string; password?: string };
  };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  PAYMENT_DECLARED: '#3b82f6',
  CONFIRMED: '#00ffaa',
  ACTIVE: '#00ffaa',
  EXPIRED: '#8888aa',
  CANCELLED: '#ff3b3b',
};

const METHOD_LABEL: Record<string, string> = {
  PAYPAL: '💙 PayPal',
  SOL: '🌐 SOL',
  XRP: '🔷 XRP',
  USDT_TRC20: '💚 USDT',
};

// ──────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState('');
  const [inputToken, setInputToken] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PAYMENT_DECLARED' | 'ACTIVE' | 'PENDING'>('PAYMENT_DECLARED');

  const fetchOrders = useCallback(async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/orders?token=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Accès refusé');
      setOrders(data.orders);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setToken('');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setToken(inputToken);
    fetchOrders(inputToken);
  };

  const handleConfirm = async (orderId: string) => {
    setConfirming(orderId);
    try {
      const res = await fetch(`/api/admin/confirm?orderId=${orderId}&token=${encodeURIComponent(token)}`);
      const success = res.ok && res.status === 200;
      setActionResult((p) => ({ ...p, [orderId]: success ? '✅ Activé !' : '❌ Erreur' }));
      if (success) setTimeout(() => fetchOrders(token), 600);
    } catch {
      setActionResult((p) => ({ ...p, [orderId]: '❌ Erreur réseau' }));
    } finally {
      setConfirming(null);
    }
  };

  const handleAction = async (orderId: string, action: 'activate' | 'cancel') => {
    setActionLoading(orderId + action);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      const label = action === 'activate' ? '✅ Activé !' : '🚫 Annulé';
      setActionResult((p) => ({ ...p, [orderId]: label }));
      setTimeout(() => fetchOrders(token), 600);
    } catch (err) {
      setActionResult((p) => ({
        ...p,
        [orderId]: `❌ ${err instanceof Error ? err.message : 'Erreur'}`,
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (orderId: string) => {
    setDeleteConfirm(null);
    setActionLoading(orderId + 'delete');
    try {
      const res = await fetch(
        `/api/admin/orders?orderId=${orderId}&token=${encodeURIComponent(token)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      // Remove from local state immediately
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      setActionResult((p) => ({
        ...p,
        [orderId]: `❌ ${err instanceof Error ? err.message : 'Erreur'}`,
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = orders.filter((o) => filter === 'ALL' || o.status === filter);

  // ── Not logged in ──
  if (!token) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          padding: '24px',
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '36px',
            width: '100%',
            maxWidth: '380px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(124,58,237,0.15)',
              color: '#a78bfa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              margin: '0 auto 20px',
            }}
          >
            <i className="fa-solid fa-shield-halved" />
          </div>

          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '1.4rem',
              fontWeight: 800,
              marginBottom: '6px',
            }}
          >
            Admin StreamMalin
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '24px' }}>
            Entrez votre token d'administration
          </p>

          <input
            type="password"
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="Token secret..."
            required
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border2)',
              borderRadius: '9px',
              padding: '12px 14px',
              fontSize: '0.9rem',
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'monospace',
              marginBottom: '14px',
            }}
          />

          {error && (
            <div
              style={{
                background: 'rgba(255,59,59,0.08)',
                border: '1px solid rgba(255,59,59,0.3)',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '0.82rem',
                color: '#ff3b3b',
                marginBottom: '14px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
              color: '#fff',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.92rem',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-right-to-bracket" style={{ marginRight: '8px' }} />
            Accéder
          </button>
        </form>
      </div>
    );
  }

  // ── Dashboard admin ──
  const pendingCount = orders.filter((o) => o.status === 'PAYMENT_DECLARED').length;
  const activeCount = orders.filter((o) => o.status === 'ACTIVE').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'ACTIVE')
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '1.6rem',
              fontWeight: 800,
              marginBottom: '4px',
            }}
          >
            <i className="fa-solid fa-bolt" style={{ color: '#a78bfa', marginRight: '10px' }} />
            Admin StreamMalin
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Tableau de bord de gestion des commandes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchOrders(token)}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '9px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`} style={{ marginRight: '6px' }} />
            Actualiser
          </button>
          <button
            onClick={() => { setToken(''); setOrders([]); }}
            style={{
              background: 'rgba(255,59,59,0.08)',
              border: '1px solid rgba(255,59,59,0.2)',
              color: '#ff3b3b',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '9px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-right-from-bracket" style={{ marginRight: '6px' }} />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '28px',
        }}
      >
        {[
          { label: 'En attente de validation', value: pendingCount, color: '#3b82f6', icon: 'fa-hourglass-half' },
          { label: 'Abonnements actifs', value: activeCount, color: '#00ffaa', icon: 'fa-circle-check' },
          { label: 'Total commandes', value: orders.length, color: '#a78bfa', icon: 'fa-list' },
          { label: 'Revenus actifs', value: `${totalRevenue.toFixed(2)}€`, color: '#f59e0b', icon: 'fa-euro-sign' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <i className={`fa-solid ${stat.icon}`} style={{ color: stat.color, fontSize: '0.9rem' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{stat.label}</span>
            </div>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1.8rem',
                fontWeight: 800,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {(
          [
            { key: 'PAYMENT_DECLARED', label: `⏳ À valider (${pendingCount})` },
            { key: 'ACTIVE', label: `✅ Actifs (${activeCount})` },
            { key: 'ALL', label: `📋 Tout (${orders.length})` },
            { key: 'PENDING', label: '🕐 En attente' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              background: filter === tab.key ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              border: filter === tab.key ? '1px solid rgba(124,58,237,0.5)' : '1px solid var(--border)',
              color: filter === tab.key ? '#a78bfa' : 'var(--muted)',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.8rem',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block' }} />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
          <i className="fa-regular fa-folder-open" style={{ fontSize: '2.5rem', marginBottom: '12px', display: 'block' }} />
          Aucune commande dans cette catégorie
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              onConfirm={() => handleConfirm(order.id)}
              onActivate={() => handleAction(order.id, 'activate')}
              onCancel={() => handleAction(order.id, 'cancel')}
              onDelete={() => setDeleteConfirm(order.id)}
              confirming={confirming === order.id}
              actionLoading={actionLoading?.startsWith(order.id) ?? false}
              actionResult={actionResult[order.id]}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: '24px',
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderTop: '3px solid #ff3b3b', borderRadius: '16px',
              padding: '28px', maxWidth: '400px', width: '100%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: 'rgba(255,59,59,0.12)', color: '#ff3b3b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', margin: '0 auto 16px',
            }}>
              <i className="fa-solid fa-trash" />
            </div>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, marginBottom: '8px' }}>
              Supprimer cette commande ?
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '6px' }}>
              ID : <code style={{ fontSize: '0.78rem' }}>{deleteConfirm}</code>
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Cette action est <strong style={{ color: '#ff3b3b' }}>irréversible</strong>.
              Le slot Disney+ sera libéré si assigné.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, padding: '11px', borderRadius: '9px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)',
                  color: 'var(--muted)', fontFamily: 'Syne, sans-serif',
                  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  flex: 1, padding: '11px', borderRadius: '9px',
                  background: '#ff3b3b', border: 'none', color: '#fff',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700,
                  fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-trash" style={{ marginRight: '6px' }} />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────
function AdminOrderCard({
  order,
  onConfirm,
  onActivate,
  onCancel,
  onDelete,
  confirming,
  actionLoading,
  actionResult,
}: {
  order: Order;
  onConfirm: () => void;
  onActivate: () => void;
  onCancel: () => void;
  onDelete: () => void;
  confirming: boolean;
  actionLoading: boolean;
  actionResult?: string;
}) {
  const statusColor = STATUS_COLOR[order.status] ?? '#8888aa';
  const isYoutube = order.service === 'YOUTUBE';
  const canConfirm = ['PENDING', 'PAYMENT_DECLARED'].includes(order.status);
  const canActivate = !['ACTIVE'].includes(order.status);
  const canCancel = !['CANCELLED', 'EXPIRED'].includes(order.status);
  const busy = confirming || actionLoading;

  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: '14px',
        padding: '18px 20px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '16px',
        alignItems: 'start',
      }}
    >
      <div>
        {/* Row 1: service + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '0.92rem',
              color: isYoutube ? '#ff3b3b' : '#a78bfa',
            }}
          >
            <i className={isYoutube ? 'fa-brands fa-youtube' : 'fa-solid fa-wand-magic-sparkles'} style={{ marginRight: '6px' }} />
            {isYoutube ? 'YouTube Premium' : 'Disney+ 4K'}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: statusColor,
              background: `${statusColor}18`,
              border: `1px solid ${statusColor}40`,
              borderRadius: '999px',
              padding: '2px 10px',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {order.status}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>

        {/* Row 2: details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.82rem' }}>
          <span>
            <span style={{ color: 'var(--muted)' }}>Client : </span>
            <code style={{ color: 'var(--text)' }}>{order.user.email}</code>
          </span>
          <span>
            <span style={{ color: 'var(--muted)' }}>Montant : </span>
            <strong style={{ color: 'var(--green)' }}>{order.amount.toFixed(2)}€</strong>
          </span>
          <span>
            <span style={{ color: 'var(--muted)' }}>Paiement : </span>
            <span>{METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
          </span>
          {order.paymentTxId && (
            <span>
              <span style={{ color: 'var(--muted)' }}>TxID : </span>
              <code
                style={{
                  color: 'var(--text)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                }}
              >
                {order.paymentTxId.slice(0, 20)}...
              </code>
            </span>
          )}
        </div>

        {/* Gmail for YouTube */}
        {isYoutube && order.gmail && (
          <div style={{ marginTop: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--muted)' }}>Gmail : </span>
            <code style={{ color: '#ff3b3b' }}>{order.gmail}</code>
            <span
              style={{
                marginLeft: '8px',
                fontSize: '0.72rem',
                color: 'var(--muted)',
                background: 'rgba(255,59,59,0.08)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Envoyer l'invitation YouTube
            </span>
          </div>
        )}

        {/* Disney slot */}
        {!isYoutube && order.slot && (
          <div style={{ marginTop: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--muted)' }}>Slot : </span>
            <code style={{ color: '#a78bfa' }}>
              {order.slot.masterAccount.email} / Profil {order.slot.profileNumber}
              {order.slot.pinCode ? ` / PIN ${order.slot.pinCode}` : ''}
            </code>
          </div>
        )}

        {/* Order ID */}
        <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--muted)' }}>
          ID : <code>{order.id}</code>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', alignItems: 'flex-end', minWidth: '140px' }}>

        {actionResult ? (
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.82rem',
            color: actionResult.startsWith('✅') || actionResult.startsWith('🚫') ? '#00ffaa' : '#ff3b3b',
            padding: '8px 12px', borderRadius: '8px',
            background: actionResult.startsWith('❌') ? 'rgba(255,59,59,0.08)' : 'rgba(0,255,170,0.06)',
            border: `1px solid ${actionResult.startsWith('❌') ? 'rgba(255,59,59,0.2)' : 'rgba(0,255,170,0.15)'}`,
            whiteSpace: 'nowrap',
          }}>
            {actionResult}
          </div>
        ) : (
          <>
            {/* Valider → Active */}
            {canActivate && (
              <button
                onClick={canConfirm ? onConfirm : onActivate}
                disabled={busy}
                style={btnStyle('#00ffaa', 'rgba(0,255,170,0.12)', busy)}
              >
                {busy && (confirming || actionLoading)
                  ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />Traitement...</>
                  : <><i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }} />Valider</>
                }
              </button>
            )}

            {/* Annuler → Cancelled */}
            {canCancel && (
              <button
                onClick={onCancel}
                disabled={busy}
                style={btnStyle('#f59e0b', 'rgba(245,158,11,0.1)', busy)}
              >
                <i className="fa-solid fa-ban" style={{ marginRight: '6px' }} />
                Annuler
              </button>
            )}

            {/* Supprimer (ouvre confirmation) */}
            <button
              onClick={onDelete}
              disabled={busy}
              style={btnStyle('#ff3b3b', 'rgba(255,59,59,0.08)', busy)}
            >
              <i className="fa-solid fa-trash" style={{ marginRight: '6px' }} />
              Supprimer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string, bg: string, disabled: boolean): React.CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}40`,
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: '0.8rem',
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
    width: '100%',
    textAlign: 'center',
    transition: 'opacity 0.15s',
  };
}
