'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────
interface SlotInfo {
  id: string;
  profileNumber: number;
  pinCode?: string;
  isAvailable: boolean;
  order: { id: string; status: string; userEmail: string } | null;
}

interface MasterAccount {
  id: string;
  service: 'YOUTUBE' | 'DISNEY';
  email: string;
  password?: string;
  active: boolean;
  maxSlots: number;
  createdAt: string;
  slots: SlotInfo[];
  availableSlots: number;
  occupiedSlots: number;
}

const SLOT_PINS_PLACEHOLDER = ['1234', '5678', '9012', '3456', '7890'];

// ──────────────────────────────────────
export default function InventoryPage() {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [accounts, setAccounts] = useState<MasterAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'YOUTUBE' | 'DISNEY'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add form state
  const [form, setForm] = useState({
    service: 'DISNEY' as 'YOUTUBE' | 'DISNEY',
    email: '',
    password: '',
    pins: ['', '', '', '', ''],
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchAccounts = useCallback(async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/inventory?token=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Accès refusé');
      setAccounts(data.accounts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setToken('');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setToken(tokenInput);
    fetchAccounts(tokenInput);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!form.email.includes('@')) { setAddError('Email invalide.'); return; }
    if (form.service === 'DISNEY' && !form.password) { setAddError('Mot de passe requis pour Disney+.'); return; }

    setAdding(true);
    try {
      const slots = Array.from({ length: 5 }, (_, i) => ({
        profileNumber: i + 1,
        pinCode: form.pins[i]?.trim() || undefined,
      }));

      const res = await fetch(`/api/admin/inventory?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: form.service,
          email: form.email.trim(),
          password: form.password.trim() || undefined,
          slots,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ service: 'DISNEY', email: '', password: '', pins: ['', '', '', '', ''] });
      setShowAddForm(false);
      await fetchAccounts(token);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Supprimer le compte "${email}" et tous ses slots ?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/admin/inventory?token=${encodeURIComponent(token)}&id=${id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAccounts(token);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/admin/inventory?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !current }),
      });
      if (!res.ok) throw new Error();
      await fetchAccounts(token);
    } catch {
      alert('Erreur lors de la mise à jour');
    } finally {
      setTogglingId(null);
    }
  };

  // ── Not logged in ──
  if (!token) {
    return (
      <div style={styles.centerPage}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <div style={styles.loginIcon}>
            <i className="fa-solid fa-boxes-stacked" />
          </div>
          <h1 style={styles.loginTitle}>Gestion des stocks</h1>
          <p style={styles.loginSub}>Entrez votre token d'administration</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Token secret..."
            required
            style={styles.input}
          />
          {error && <div style={styles.errorBox}>{error}</div>}
          <button type="submit" style={styles.submitBtn}>
            <i className="fa-solid fa-right-to-bracket" style={{ marginRight: 8 }} />
            Accéder
          </button>
        </form>
      </div>
    );
  }

  // ── Stats globales ──
  const ytAccounts = accounts.filter((a) => a.service === 'YOUTUBE');
  const disAccounts = accounts.filter((a) => a.service === 'DISNEY');
  const totalSlots = accounts.reduce((s, a) => s + a.maxSlots, 0);
  const availableSlots = accounts.reduce((s, a) => s + a.availableSlots, 0);
  const occupiedSlots = accounts.reduce((s, a) => s + a.occupiedSlots, 0);

  const filtered = accounts.filter((a) => filter === 'ALL' || a.service === filter);

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <Link href="/admin" style={styles.breadcrumbLink}>
              <i className="fa-solid fa-gauge-high" style={{ marginRight: 6 }} />Admin
            </Link>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.6rem', color: 'var(--muted)', margin: '0 8px' }} />
            <span style={{ color: 'var(--text)' }}>Inventaire</span>
          </div>
          <h1 style={styles.pageTitle}>
            <i className="fa-solid fa-boxes-stacked" style={{ color: '#a78bfa', marginRight: 10 }} />
            Gestion des stocks
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Comptes maîtres YouTube et Disney+
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fetchAccounts(token)} disabled={loading} style={styles.refreshBtn}>
            <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`} style={{ marginRight: 6 }} />
            Actualiser
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} style={styles.addBtn}>
            <i className={`fa-solid ${showAddForm ? 'fa-xmark' : 'fa-plus'}`} style={{ marginRight: 6 }} />
            {showAddForm ? 'Annuler' : 'Ajouter un compte'}
          </button>
        </div>
      </div>

      {/* ── Stats globales ── */}
      <div style={styles.statsGrid}>
        {[
          { label: 'Comptes YouTube', value: ytAccounts.length, color: '#ff3b3b', icon: 'fa-brands fa-youtube' },
          { label: 'Comptes Disney+', value: disAccounts.length, color: '#a78bfa', icon: 'fa-solid fa-wand-magic-sparkles' },
          { label: 'Slots disponibles', value: availableSlots, color: '#00ffaa', icon: 'fa-solid fa-circle-check' },
          { label: 'Slots occupés', value: occupiedSlots, color: '#f59e0b', icon: 'fa-solid fa-user-check' },
          { label: 'Total slots', value: totalSlots, color: '#3b82f6', icon: 'fa-solid fa-layer-group' },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <i className={s.icon} style={{ color: s.color, fontSize: '0.85rem' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', fontWeight: 800, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Formulaire d'ajout ── */}
      {showAddForm && (
        <form onSubmit={handleAdd} style={styles.addForm}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>
            <i className="fa-solid fa-plus" style={{ color: '#00ffaa', marginRight: 8 }} />
            Ajouter un nouveau compte maître
          </h3>

          <div style={styles.formGrid}>
            {/* Service */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Service</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['DISNEY', 'YOUTUBE'] as const).map((svc) => (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, service: svc }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 8,
                      border: form.service === svc ? `1px solid ${svc === 'YOUTUBE' ? '#ff3b3b' : '#a78bfa'}` : '1px solid var(--border)',
                      background: form.service === svc
                        ? svc === 'YOUTUBE' ? 'rgba(255,59,59,0.1)' : 'rgba(124,58,237,0.1)'
                        : 'rgba(255,255,255,0.03)',
                      color: form.service === svc
                        ? svc === 'YOUTUBE' ? '#ff3b3b' : '#a78bfa'
                        : 'var(--muted)',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    <i className={svc === 'YOUTUBE' ? 'fa-brands fa-youtube' : 'fa-solid fa-wand-magic-sparkles'} style={{ marginRight: 6 }} />
                    {svc === 'YOUTUBE' ? 'YouTube' : 'Disney+'}
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email du compte maître</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="compte@example.com"
                required
                style={styles.input}
              />
            </div>

            {/* Mot de passe */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                Mot de passe{form.service === 'YOUTUBE' && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> (optionnel pour YouTube)</span>}
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={form.service === 'DISNEY' ? 'MotDePasse123!' : 'Optionnel'}
                style={styles.input}
              />
            </div>
          </div>

          {/* PINs Disney+ */}
          {form.service === 'DISNEY' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ ...styles.label, marginBottom: 10, display: 'block' }}>
                Codes PIN des 5 profils <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optionnel)</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 4 }}>Profil {i + 1}</div>
                    <input
                      type="text"
                      value={form.pins[i]}
                      onChange={(e) => setForm((f) => {
                        const pins = [...f.pins];
                        pins[i] = e.target.value;
                        return { ...f, pins };
                      })}
                      placeholder={SLOT_PINS_PLACEHOLDER[i]}
                      maxLength={8}
                      style={{ ...styles.input, textAlign: 'center', fontFamily: 'monospace', letterSpacing: '0.1em' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {addError && <div style={{ ...styles.errorBox, marginTop: 14 }}>{addError}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" disabled={adding} style={styles.submitBtn}>
              {adding
                ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Ajout en cours...</>
                : <><i className="fa-solid fa-plus" style={{ marginRight: 8 }} />Ajouter le compte</>}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} style={styles.cancelBtn}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: 8, margin: '20px 0 16px', flexWrap: 'wrap' }}>
        {([
          { key: 'ALL', label: `Tous (${accounts.length})` },
          { key: 'DISNEY', label: `Disney+ (${disAccounts.length})` },
          { key: 'YOUTUBE', label: `YouTube (${ytAccounts.length})` },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            background: filter === tab.key ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
            border: filter === tab.key ? '1px solid rgba(124,58,237,0.5)' : '1px solid var(--border)',
            color: filter === tab.key ? '#a78bfa' : 'var(--muted)',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.8rem',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Liste des comptes ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', display: 'block', marginBottom: 12 }} />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <i className="fa-solid fa-box-open" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }} />
          Aucun compte dans cette catégorie.
          <br />
          <button onClick={() => setShowAddForm(true)} style={{ ...styles.addBtn, marginTop: 16 }}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} /> Ajouter un compte
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((acc) => (
            <AccountRow
              key={acc.id}
              account={acc}
              expanded={expandedId === acc.id}
              onToggleExpand={() => setExpandedId(expandedId === acc.id ? null : acc.id)}
              onDelete={() => handleDelete(acc.id, acc.email)}
              onToggleActive={() => handleToggleActive(acc.id, acc.active)}
              deleting={deletingId === acc.id}
              toggling={togglingId === acc.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────
// AccountRow component
// ──────────────────────────────────────
function AccountRow({
  account, expanded, onToggleExpand, onDelete, onToggleActive, deleting, toggling,
}: {
  account: MasterAccount;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  deleting: boolean;
  toggling: boolean;
}) {
  const isYt = account.service === 'YOUTUBE';
  const accentColor = isYt ? '#ff3b3b' : '#a78bfa';
  const fillPct = Math.round((account.occupiedSlots / account.maxSlots) * 100);

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${account.active ? 'var(--border)' : 'rgba(136,136,170,0.3)'}`,
      borderLeft: `3px solid ${account.active ? accentColor : 'var(--muted)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      opacity: account.active ? 1 : 0.6,
    }}>
      {/* Row header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Service icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: isYt ? 'rgba(255,59,59,0.12)' : 'rgba(124,58,237,0.12)',
          color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', flexShrink: 0,
        }}>
          <i className={isYt ? 'fa-brands fa-youtube' : 'fa-solid fa-wand-magic-sparkles'} />
        </div>

        {/* Email + password */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.88rem', marginBottom: 2 }}>
            <code style={{ color: 'var(--text)' }}>{account.email}</code>
            {!account.active && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--muted)', background: 'rgba(136,136,170,0.1)', padding: '1px 7px', borderRadius: 999 }}>
                désactivé
              </span>
            )}
          </div>
          {account.password && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Pass : <code style={{ color: 'var(--text)', fontSize: '0.75rem' }}>{account.password}</code>
            </div>
          )}
        </div>

        {/* Slot bar */}
        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 4 }}>
            {account.occupiedSlots}/{account.maxSlots} slots
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, transition: 'width 0.3s',
              width: `${fillPct}%`,
              background: fillPct >= 100 ? '#ff3b3b' : fillPct >= 60 ? '#f59e0b' : '#00ffaa',
            }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onToggleExpand} style={styles.iconBtn} title="Voir les slots">
            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} />
          </button>
          <button
            onClick={onToggleActive}
            disabled={toggling}
            style={{ ...styles.iconBtn, color: account.active ? '#f59e0b' : '#00ffaa' }}
            title={account.active ? 'Désactiver' : 'Activer'}
          >
            <i className={`fa-solid ${toggling ? 'fa-spinner fa-spin' : account.active ? 'fa-pause' : 'fa-play'}`} />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting || account.occupiedSlots > 0}
            style={{
              ...styles.iconBtn,
              color: '#ff3b3b',
              opacity: (deleting || account.occupiedSlots > 0) ? 0.4 : 1,
              cursor: account.occupiedSlots > 0 ? 'not-allowed' : 'pointer',
            }}
            title={account.occupiedSlots > 0 ? 'Impossible : des slots sont occupés' : 'Supprimer'}
          >
            <i className={`fa-solid ${deleting ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
          </button>
        </div>
      </div>

      {/* Expanded: slot details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 10 }}>Détail des 5 profils :</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {account.slots.map((slot) => (
              <div key={slot.id} style={{
                background: slot.isAvailable ? 'rgba(0,255,170,0.05)' : 'rgba(245,158,11,0.05)',
                border: `1px solid ${slot.isAvailable ? 'rgba(0,255,170,0.2)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: 8, padding: '10px 12px',
              }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.8rem', marginBottom: 4 }}>
                  Profil {slot.profileNumber}
                  <span style={{
                    marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px', borderRadius: 999,
                    background: slot.isAvailable ? 'rgba(0,255,170,0.1)' : 'rgba(245,158,11,0.1)',
                    color: slot.isAvailable ? '#00ffaa' : '#f59e0b',
                  }}>
                    {slot.isAvailable ? 'libre' : 'occupé'}
                  </span>
                </div>
                {slot.pinCode && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    PIN : <code style={{ color: 'var(--text)' }}>{slot.pinCode}</code>
                  </div>
                )}
                {slot.order && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>
                    <i className="fa-solid fa-user" style={{ marginRight: 4 }} />
                    {slot.order.userEmail}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────
// Styles
// ──────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)', padding: '24px', maxWidth: 1100, margin: '0 auto' },
  centerPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  loginBox: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 36, width: '100%', maxWidth: 380, textAlign: 'center' },
  loginIcon: { width: 56, height: 56, borderRadius: 14, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 20px' },
  loginTitle: { fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 },
  loginSub: { fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 24 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 },
  breadcrumb: { display: 'flex', alignItems: 'center', fontSize: '0.78rem', marginBottom: 8 },
  breadcrumbLink: { color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.2s' },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 },
  statCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' },
  addForm: { background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, marginBottom: 24 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', fontSize: '0.88rem', color: 'var(--text)', outline: 'none', fontFamily: 'DM Sans, sans-serif' },
  submitBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.88rem', padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid var(--border2)', color: 'var(--muted)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem', padding: '11px 16px', borderRadius: 10, cursor: 'pointer' },
  refreshBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border2)', color: 'var(--text)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.82rem', padding: '9px 16px', borderRadius: 8, cursor: 'pointer' },
  addBtn: { display: 'inline-flex', alignItems: 'center', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.82rem', padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' },
  iconBtn: { width: 32, height: 32, borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem', transition: 'background 0.2s' },
  errorBox: { background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#ff3b3b' },
};
