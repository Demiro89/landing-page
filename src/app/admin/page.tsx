'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────
interface SlotInfo {
  id: string;
  profileNumber: number;
  isAvailable: boolean;
  pinCode?: string;
  assignedEmail?: string;
}

interface MasterAccount {
  id: string;
  service: string;
  email: string;
  password?: string;
  maxSlots: number;
  active: boolean;
  createdAt: string;
  slotsTotal: number;
  slotsAvailable: number;
  slots: SlotInfo[];
}

interface Order {
  id: string;
  service: 'YOUTUBE' | 'DISNEY';
  status: string;
  amount: number;
  paymentMethod: string;
  paymentTxId?: string;
  gmail?: string;
  invitationSentAt?: string | null;
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
  PAYPAL:     '💙 PayPal',
  SOL:        '🌐 SOL',
  XRP:        '🔷 XRP',
  USDT_TRC20: '💚 USDT',
  STRIPE:     '💳 Stripe',
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
  const [inviteConfirm, setInviteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PAYMENT_DECLARED' | 'ACTIVE' | 'PENDING'>('PAYMENT_DECLARED');
  const [tab, setTab] = useState<'orders' | 'accounts'>('orders');

  // ── Master accounts state ──
  const [accounts, setAccounts] = useState<MasterAccount[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState('');
  const [addAccLoading, setAddAccLoading] = useState(false);
  const [slotLoading, setSlotLoading] = useState<string | null>(null);
  const [deleteAccConfirm, setDeleteAccConfirm] = useState<string | null>(null);
  const [editAcc, setEditAcc] = useState<{ id: string; email: string; password: string } | null>(null);
  const [editSlot, setEditSlot] = useState<{ accId: string; slotId: string; email: string } | null>(null);
  const [slotEmailLoading, setSlotEmailLoading] = useState<string | null>(null);
  const newAccRef = useRef<{ service: string; email: string; password: string; maxSlots: string }>({
    service: '', email: '', password: '', maxSlots: '5',
  });

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

  const handleSendYouTubeInvite = async (orderId: string) => {
    setInviteConfirm(null);
    setActionLoading(orderId + 'invite');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId, action: 'send_youtube_invite' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setActionResult((p) => ({ ...p, [orderId]: '📧 Invitation envoyée' }));
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

  // ── Master accounts ──
  const fetchAccounts = useCallback(async () => {
    setAccLoading(true);
    setAccError('');
    try {
      const res = await fetch(`/api/admin/master-accounts?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setAccounts(data.accounts);
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setAccLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === 'accounts' && token) fetchAccounts();
  }, [tab, token, fetchAccounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const { service, email, password, maxSlots } = newAccRef.current;
    if (!email.includes('@')) return;
    setAddAccLoading(true);
    try {
      const res = await fetch('/api/admin/master-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, service, email, password, maxSlots: parseInt(maxSlots) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      newAccRef.current = { service: '', email: '', password: '', maxSlots: '5' };
      // Force re-render of form by resetting inputs
      (e.target as HTMLFormElement).reset();
      fetchAccounts();
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setAddAccLoading(false);
    }
  };

  const handleUpdateAccount = async (id: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/admin/master-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id, action: 'update_credentials', email, password }),
      });
      if (!res.ok) throw new Error('Erreur mise à jour');
      setEditAcc(null);
      fetchAccounts();
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleAdjustSlots = async (id: string, delta: number) => {
    // Clé unique sans ambiguïté : "id_+1" ou "id_-1"
    const loadingKey = id + '_' + (delta > 0 ? '+1' : '-1');
    setSlotLoading(loadingKey);
    setAccError('');
    try {
      const res = await fetch('/api/admin/master-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id, action: 'adjust_slots', delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      // Recompute disponibilités depuis le tableau slots retourné (source de vérité)
      const returnedSlots: SlotInfo[] = data.account.slots ?? [];
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                maxSlots: data.account.maxSlots,
                slotsTotal: returnedSlots.length,
                slotsAvailable: returnedSlots.filter((s) => s.isAvailable).length,
                slots: returnedSlots,
              }
            : acc
        )
      );
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSlotLoading(null);
    }
  };

  const handleHardDeleteAccount = async (id: string) => {
    setDeleteAccConfirm(null);
    setAccError('');
    try {
      const res = await fetch(
        `/api/admin/master-accounts?token=${encodeURIComponent(token)}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur suppression');
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleUpdateSlotEmail = async (accId: string, slotId: string, email: string) => {
    setSlotEmailLoading(slotId);
    setAccError('');
    try {
      const res = await fetch('/api/admin/master-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id: accId, action: 'update_slot_email', slotId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === accId
            ? { ...acc, slots: data.account.slots }
            : acc
        )
      );
      setEditSlot(null);
    } catch (err) {
      setAccError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSlotEmailLoading(null);
    }
  };

  const handleNotifyAccess = async (orderId: string) => {
    setActionLoading(orderId + 'notify');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId, action: 'notify_access' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setActionResult((p) => ({ ...p, [orderId]: '📧 Accès notifiés' }));
    } catch (err) {
      setActionResult((p) => ({ ...p, [orderId]: `❌ ${err instanceof Error ? err.message : 'Erreur'}` }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkInvitationSent = async (orderId: string) => {
    setActionLoading(orderId + 'mark');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, orderId, action: 'mark_invitation_sent' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setOrders((prev) =>
        prev.map((o) => o.id === orderId ? { ...o, invitationSentAt: data.invitationSentAt } : o)
      );
      setActionResult((p) => ({ ...p, [orderId]: '✅ Invitation marquée comme envoyée' }));
    } catch (err) {
      setActionResult((p) => ({ ...p, [orderId]: `❌ ${err instanceof Error ? err.message : 'Erreur'}` }));
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

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        {([
          { key: 'orders', label: '📋 Commandes', count: orders.length },
          { key: 'accounts', label: '🗄️ Comptes Maîtres', count: null },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? 'rgba(124,58,237,0.2)' : 'transparent',
              border: tab === t.key ? '1px solid rgba(124,58,237,0.5)' : '1px solid transparent',
              color: tab === t.key ? '#a78bfa' : 'var(--muted)',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
              padding: '9px 18px', borderRadius: '10px', cursor: 'pointer',
            }}
          >
            {t.label}{t.count !== null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ═══ TAB: COMPTES MAÎTRES ═══ */}
      {tab === 'accounts' && (
        <div>
          {accError && (
            <div style={{ background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.3)', borderRadius: '10px', padding: '12px', color: '#ff3b3b', fontSize: '0.82rem', marginBottom: '16px' }}>
              {accError}
            </div>
          )}

          {/* Add account form */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: '16px' }}>
              <i className="fa-solid fa-plus" style={{ color: '#00ffaa', marginRight: '8px' }} />
              Ajouter un compte maître
            </h3>
            <form onSubmit={handleAddAccount}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '14px' }}>
                <label style={smallLabel}>
                  Service (texte libre)
                  <input
                    type="text"
                    required
                    placeholder="Netflix, Spotify, Disney+…"
                    onChange={(e) => { newAccRef.current.service = e.target.value; }}
                    style={smallInput}
                  />
                </label>
                <label style={smallLabel}>
                  Email du compte
                  <input
                    type="email"
                    required
                    placeholder="compte@exemple.com"
                    onChange={(e) => { newAccRef.current.email = e.target.value; }}
                    style={smallInput}
                  />
                </label>
                <label style={smallLabel}>
                  Mot de passe
                  <input
                    type="text"
                    placeholder="(optionnel)"
                    onChange={(e) => { newAccRef.current.password = e.target.value; }}
                    style={smallInput}
                  />
                </label>
                <label style={smallLabel}>
                  Nb de slots
                  <input
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={5}
                    onChange={(e) => { newAccRef.current.maxSlots = e.target.value; }}
                    style={smallInput}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={addAccLoading}
                style={{
                  background: 'rgba(0,255,170,0.1)', border: '1px solid rgba(0,255,170,0.3)',
                  color: '#00ffaa', fontFamily: 'Syne, sans-serif', fontWeight: 700,
                  fontSize: '0.82rem', padding: '9px 18px', borderRadius: '9px',
                  cursor: addAccLoading ? 'not-allowed' : 'pointer', opacity: addAccLoading ? 0.6 : 1,
                }}
              >
                {addAccLoading
                  ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />Ajout...</>
                  : <><i className="fa-solid fa-plus" style={{ marginRight: '6px' }} />Créer le compte + slots</>
                }
              </button>
            </form>
          </div>

          {/* Accounts list */}
          {accLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {accounts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
                  Aucun compte maître. Ajoutez-en un ci-dessus.
                </div>
              )}
              {accounts.map((acc) => {
                const svcColor = acc.service === 'YOUTUBE' ? '#ff3b3b' : '#a78bfa';
                const svcIcon = acc.service === 'YOUTUBE' ? 'fa-brands fa-youtube' : 'fa-solid fa-server';
                const isLoadingPlus = slotLoading === acc.id + '_+1';
                const isLoadingMinus = slotLoading === acc.id + '_-1';
                const anySlotLoading = isLoadingPlus || isLoadingMinus;
                return (
                <div
                  key={acc.id}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${svcColor}`,
                    borderRadius: '12px', padding: '16px 20px',
                    opacity: acc.active ? 1 : 0.55,
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start',
                  }}
                >
                  <div>
                    {/* Service name + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.9rem', color: svcColor }}>
                        <i className={svcIcon} style={{ marginRight: '6px' }} />
                        {acc.service}
                      </span>
                      {!acc.active && <span style={{ fontSize: '0.7rem', background: 'rgba(255,59,59,0.1)', color: '#ff3b3b', border: '1px solid rgba(255,59,59,0.3)', padding: '2px 8px', borderRadius: '4px' }}>Désactivé</span>}
                    </div>

                    {/* Edit credentials inline form OR info display */}
                    {editAcc?.id === acc.id ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                        <input
                          type="email"
                          value={editAcc.email}
                          onChange={(e) => setEditAcc({ ...editAcc, email: e.target.value })}
                          style={{ ...smallInput, width: '200px' }}
                        />
                        <input
                          type="text"
                          value={editAcc.password}
                          placeholder="Mot de passe"
                          onChange={(e) => setEditAcc({ ...editAcc, password: e.target.value })}
                          style={{ ...smallInput, width: '180px' }}
                        />
                        <button onClick={() => handleUpdateAccount(editAcc.id, editAcc.email, editAcc.password)} style={{ background: '#00ffaa', color: '#000', border: 'none', borderRadius: '7px', padding: '7px 14px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                          ✅ Sauvegarder
                        </button>
                        <button onClick={() => setEditAcc(null)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: '7px', padding: '7px 12px', fontSize: '0.78rem', cursor: 'pointer' }}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                        <span><span style={{ color: 'var(--muted)' }}>Email : </span><code>{acc.email}</code></span>
                        {acc.password && <span><span style={{ color: 'var(--muted)' }}>Mdp : </span><code>{acc.password}</code></span>}
                      </div>
                    )}

                    {/* Slot counter + +/- adjustment */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Slots :</span>
                      <strong style={{ fontSize: '0.82rem', color: acc.slotsAvailable === 0 ? '#ff3b3b' : '#00ffaa' }}>
                        {acc.slotsAvailable} dispo / {acc.slotsTotal}
                      </strong>
                      <button
                        onClick={() => handleAdjustSlots(acc.id, -1)}
                        disabled={anySlotLoading || acc.slotsAvailable === 0}
                        title="Retirer un slot libre"
                        style={{
                          width: '26px', height: '26px', borderRadius: '6px',
                          background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.3)',
                          color: '#ff3b3b', fontWeight: 700, fontSize: '0.9rem',
                          cursor: anySlotLoading || acc.slotsAvailable === 0 ? 'not-allowed' : 'pointer',
                          opacity: anySlotLoading || acc.slotsAvailable === 0 ? 0.4 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {isLoadingMinus ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.6rem' }} /> : '−'}
                      </button>
                      <button
                        onClick={() => handleAdjustSlots(acc.id, 1)}
                        disabled={anySlotLoading}
                        title="Ajouter un slot"
                        style={{
                          width: '26px', height: '26px', borderRadius: '6px',
                          background: 'rgba(0,255,170,0.1)', border: '1px solid rgba(0,255,170,0.3)',
                          color: '#00ffaa', fontWeight: 700, fontSize: '0.9rem',
                          cursor: anySlotLoading ? 'not-allowed' : 'pointer',
                          opacity: anySlotLoading ? 0.4 : 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {isLoadingPlus ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.6rem' }} /> : '+'}
                      </button>
                    </div>

                    {/* Slot list — email par slot */}
                    {acc.slots && acc.slots.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {acc.slots.map((slot) => {
                          const isEditingSlot = editSlot?.slotId === slot.id;
                          const isSavingSlot = slotEmailLoading === slot.id;
                          return (
                            <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                background: slot.isAvailable ? 'rgba(255,255,255,0.05)' : 'rgba(0,255,170,0.08)',
                                border: `1px solid ${slot.isAvailable ? 'var(--border2)' : 'rgba(0,255,170,0.2)'}`,
                                color: slot.isAvailable ? 'var(--muted)' : '#00ffaa',
                                fontWeight: 700, fontSize: '0.65rem',
                              }}>
                                {slot.profileNumber}
                              </span>

                              {isEditingSlot ? (
                                <>
                                  <input
                                    type="email"
                                    value={editSlot.email}
                                    onChange={(e) => setEditSlot({ ...editSlot, email: e.target.value })}
                                    placeholder="email@exemple.com"
                                    style={{ ...smallInput, padding: '4px 8px', fontSize: '0.76rem', width: '180px' }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleUpdateSlotEmail(acc.id, slot.id, editSlot.email)}
                                    disabled={isSavingSlot}
                                    style={{ background: '#00ffaa', color: '#000', border: 'none', borderRadius: '5px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    {isSavingSlot ? '...' : '✓'}
                                  </button>
                                  <button
                                    onClick={() => setEditSlot(null)}
                                    style={{ background: 'transparent', color: 'var(--muted)', border: 'none', cursor: 'pointer', fontSize: '0.78rem', padding: '0 4px' }}
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <>
                                  {slot.isAvailable ? (
                                    <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Libre</span>
                                  ) : (
                                    <code style={{ color: 'var(--text)', fontSize: '0.76rem' }}>
                                      {slot.assignedEmail ?? '—'}
                                    </code>
                                  )}
                                  <button
                                    onClick={() => setEditSlot({ accId: acc.id, slotId: slot.id, email: slot.assignedEmail ?? '' })}
                                    title="Modifier l'email du slot"
                                    style={{ background: 'transparent', color: 'var(--muted)', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.72rem', opacity: 0.7, lineHeight: 1 }}
                                  >
                                    <i className="fa-solid fa-pen" />
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '6px' }}>
                      ID : <code>{acc.id}</code>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '7px', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <button
                      onClick={() => setEditAcc({ id: acc.id, email: acc.email, password: acc.password ?? '' })}
                      style={btnStyle('#3b82f6', 'rgba(59,130,246,0.08)', false)}
                    >
                      <i className="fa-solid fa-pen" style={{ marginRight: '5px' }} />Modifier
                    </button>
                    <button
                      onClick={() => setDeleteAccConfirm(acc.id)}
                      style={btnStyle('#ff3b3b', 'rgba(255,59,59,0.08)', false)}
                    >
                      <i className="fa-solid fa-trash" style={{ marginRight: '5px' }} />Supprimer
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: COMMANDES ═══ */}
      {tab === 'orders' && <>

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
              onSendInvite={() => setInviteConfirm(order.id)}
              onNotifyAccess={() => handleNotifyAccess(order.id)}
              onMarkInvitationSent={() => handleMarkInvitationSent(order.id)}
              confirming={confirming === order.id}
              actionLoading={actionLoading?.startsWith(order.id) ?? false}
              actionResult={actionResult[order.id]}
            />
          ))}
        </div>
      )}

      {/* YouTube invite confirmation modal */}
      {inviteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}
          onClick={() => setInviteConfirm(null)}
        >
          <div
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: '3px solid #ff3b3b', borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '100%', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,59,59,0.12)', color: '#ff3b3b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', margin: '0 auto 16px' }}>
              <i className="fa-brands fa-youtube" />
            </div>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, marginBottom: '8px' }}>
              Confirmer l'envoi de l'invitation ?
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              Un email sera envoyé au client pour lui indiquer que son invitation YouTube Premium est en route et lui rappeler de vérifier ses spams.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setInviteConfirm(null)} style={{ flex: 1, padding: '11px', borderRadius: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border2)', color: 'var(--muted)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={() => handleSendYouTubeInvite(inviteConfirm)} style={{ flex: 1, padding: '11px', borderRadius: '9px', background: '#ff3b3b', border: 'none', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                <i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }} />
                Envoyer l'invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── end orders tab ── */}
      </>}

      {/* Account hard-delete confirmation modal */}
      {deleteAccConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, padding: '24px',
          }}
          onClick={() => setDeleteAccConfirm(null)}
        >
          <div
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderTop: '3px solid #ff3b3b', borderRadius: '16px',
              padding: '28px', maxWidth: '420px', width: '100%',
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
              <i className="fa-solid fa-server" />
            </div>
            <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, marginBottom: '8px' }}>
              Supprimer ce compte maître ?
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '6px' }}>
              ID : <code style={{ fontSize: '0.78rem' }}>{deleteAccConfirm}</code>
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Cette action est <strong style={{ color: '#ff3b3b' }}>irréversible</strong>.
              Tous les slots associés seront supprimés. Les commandes actives seront détachées (non supprimées).
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setDeleteAccConfirm(null)}
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
                onClick={() => handleHardDeleteAccount(deleteAccConfirm)}
                style={{
                  flex: 1, padding: '11px', borderRadius: '9px',
                  background: '#ff3b3b', border: 'none', color: '#fff',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700,
                  fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-trash" style={{ marginRight: '6px' }} />
                Supprimer définitivement
              </button>
            </div>
          </div>
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
  onSendInvite,
  onNotifyAccess,
  onMarkInvitationSent,
  confirming,
  actionLoading,
  actionResult,
}: {
  order: Order;
  onConfirm: () => void;
  onActivate: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSendInvite: () => void;
  onNotifyAccess: () => void;
  onMarkInvitationSent: () => void;
  confirming: boolean;
  actionLoading: boolean;
  actionResult?: string;
}) {
  const statusColor = STATUS_COLOR[order.status] ?? '#8888aa';
  const isYoutube = order.service === 'YOUTUBE';
  const canConfirm = ['PENDING', 'PAYMENT_DECLARED'].includes(order.status);
  const canActivate = !['ACTIVE'].includes(order.status);
  const canCancel = !['CANCELLED', 'EXPIRED'].includes(order.status);
  const showInviteBtn = isYoutube && order.status === 'ACTIVE';
  const showNotifyBtn = !isYoutube && order.status === 'ACTIVE' && order.slot;
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
            {/* Envoyer invitation YouTube + Marquer comme envoyé */}
            {showInviteBtn && (
              <>
                <button
                  onClick={onSendInvite}
                  disabled={busy}
                  style={btnStyle('#ff3b3b', 'rgba(255,59,59,0.08)', busy)}
                >
                  <i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }} />
                  Envoyer l'invitation
                </button>

                {order.invitationSentAt ? (
                  <div style={{
                    fontSize: '0.72rem', color: '#00ffaa',
                    background: 'rgba(0,255,170,0.06)',
                    border: '1px solid rgba(0,255,170,0.2)',
                    borderRadius: '7px', padding: '5px 10px',
                    textAlign: 'center', whiteSpace: 'nowrap',
                  }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: '5px' }} />
                    Envoyée le {new Date(order.invitationSentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </div>
                ) : (
                  <button
                    onClick={onMarkInvitationSent}
                    disabled={busy}
                    style={btnStyle('#00ffaa', 'rgba(0,255,170,0.06)', busy)}
                  >
                    <i className="fa-solid fa-envelope-circle-check" style={{ marginRight: '6px' }} />
                    Marquer envoyée
                  </button>
                )}
              </>
            )}

            {/* Notifier accès Disney+ */}
            {showNotifyBtn && (
              <button
                onClick={onNotifyAccess}
                disabled={busy}
                style={btnStyle('#3b82f6', 'rgba(59,130,246,0.08)', busy)}
              >
                <i className="fa-solid fa-bell" style={{ marginRight: '6px' }} />
                Notifier accès
              </button>
            )}

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
          </>
        )}

        {/* Supprimer — toujours visible quel que soit le statut ou actionResult */}
        <button
          onClick={onDelete}
          disabled={busy}
          style={btnStyle('#ff3b3b', 'rgba(255,59,59,0.08)', busy)}
        >
          <i className="fa-solid fa-trash" style={{ marginRight: '6px' }} />
          Supprimer
        </button>
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

const smallLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--muted)',
};

const smallInput: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border2)',
  borderRadius: '7px',
  padding: '8px 11px',
  fontSize: '0.82rem',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'DM Sans, monospace',
  width: '100%',
};
