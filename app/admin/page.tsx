'use client';

import React, { useState, useEffect } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Service {
  id: string; name: string; tagline: string; price: number; original: number;
  maxSlots: number; active: boolean; icon: string; gradient: string; features: string[];
  stocks: StockAccount[];
}
interface StockAccount {
  id: string; serviceId: string; accountsBoughtPrice: number; price: number;
  maxSlots: number; filledSlots: number; details: string; createdAt: string;
}
interface Order {
  id: string; date: string; price: number; fee: number; total: number;
  clientEmail: string; status: string; details: string;
  service: { name: string; icon: string };
  stockAccount: { accountsBoughtPrice: number };
}
interface Kpis {
  totalRevenue: number; totalCogs: number; totalInvestment: number;
  netProfit: number; marginPercentage: number;
}
interface Client {
  email: string; firstOrderDate: string; orderCount: number;
  totalSpent: number; activeOrders: number;
}
interface Settings { [key: string]: string }

type AdminPage = 'dashboard' | 'stocks' | 'services' | 'clients' | 'settings';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt = (n: number) => n.toFixed(2).replace('.', ',') + '€';

function toast(msg: string) {
  const el = document.getElementById('sm-toast');
  if (!el) return;
  el.textContent = '✅ ' + msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3500);
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activePage, setActivePage] = useState<AdminPage>('dashboard');

  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ totalRevenue: 0, totalCogs: 0, totalInvestment: 0, netProfit: 0, marginPercentage: 0 });
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<Settings>({
    crypto_btc: '', crypto_eth: '', crypto_usdt: '', crypto_ltc: '',
    gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'true',
  });

  const [stockForm, setStockForm] = useState({ serviceId: '', accountsBoughtPrice: '', price: '', maxSlots: '', details: '' });
  const [editStock, setEditStock] = useState<StockAccount | null>(null);
  const [srvForm, setSrvForm] = useState({ id: '', name: '', icon: '', gradient: '', price: '', original: '', tagline: '', maxSlots: '', features: '' });

  /* ─── Auth ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/admin/auth').then(r => r.json()).then(d => { if (d.authenticated) { setAuthed(true); loadAll(); } });
  }, []);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const r = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (d.success) { setAuthed(true); loadAll(); }
    else setLoginError('Mot de passe incorrect. Veuillez réessayer.');
  };

  const doLogout = async () => {
    await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setAuthed(false);
  };

  /* ─── Data ────────────────────────────────────────────────────────────── */
  const loadAll = async () => {
    const [stockRes, clientRes, settRes] = await Promise.all([
      fetch('/api/admin/stock').then(r => r.json()),
      fetch('/api/admin/clients').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
    ]);
    if (stockRes.success) { setServices(stockRes.services); setOrders(stockRes.orders); setKpis(stockRes.kpis); }
    if (clientRes.success) setClients(clientRes.clients);
    if (settRes.success) setSettings(settRes.settings);
  };

  /* ─── Chart ───────────────────────────────────────────────────────────── */
  const chartData = (() => {
    const days: { label: string; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      const dayOrders = orders.filter(o => new Date(o.date).toDateString() === d.toDateString());
      const profit = dayOrders.reduce((acc, o) => acc + o.total - (o.total * 0.25), 0);
      days.push({ label: label.charAt(0).toUpperCase() + label.slice(1), profit });
    }
    return days;
  })();
  const maxProfit = Math.max(...chartData.map(d => d.profit), 1);

  /* ─── Actions stock ───────────────────────────────────────────────────── */
  const addStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'add_stock', serviceId: stockForm.serviceId, accountsBoughtPrice: stockForm.accountsBoughtPrice || '0', price: stockForm.price, maxSlots: stockForm.maxSlots, filledSlots: 0, details: stockForm.details }),
    });
    const d = await r.json();
    if (d.success) { toast('Compte de stock ajouté !'); setStockForm({ serviceId: '', accountsBoughtPrice: '', price: '', maxSlots: '', details: '' }); loadAll(); }
    else toast('Erreur : ' + d.error);
  };

  const addStockInline = async (serviceId: string, price: string, maxSlots: string, details: string): Promise<boolean> => {
    const r = await fetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_stock', serviceId, accountsBoughtPrice: '0', price, maxSlots, filledSlots: 0, details }),
    });
    const d = await r.json();
    if (d.success) { toast('Compte de stock ajouté !'); loadAll(); return true; }
    toast('Erreur : ' + d.error);
    return false;
  };

  const saveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStock) return;
    const r = await fetch('/api/admin/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_stock', id: editStock.id, accountsBoughtPrice: editStock.accountsBoughtPrice, price: editStock.price, maxSlots: editStock.maxSlots, filledSlots: editStock.filledSlots, details: editStock.details }),
    });
    const d = await r.json();
    if (d.success) { toast('Compte de stock mis à jour !'); setEditStock(null); loadAll(); }
    else toast('Erreur : ' + d.error);
  };

  const deleteStock = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce compte de stock ?')) return;
    await fetch(`/api/admin/stock?id=${id}&type=stock`, { method: 'DELETE' });
    toast('Stock supprimé.');
    loadAll();
  };

  /* ─── Actions services ────────────────────────────────────────────────── */
  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = srvForm.features.split(',').map(f => f.trim()).filter(Boolean);
    const r = await fetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_service', id: srvForm.id, name: srvForm.name, icon: srvForm.icon, gradient: srvForm.gradient || 'linear-gradient(135deg, #a855f7, #3b82f6)', price: srvForm.price, original: srvForm.original, tagline: srvForm.tagline, maxSlots: srvForm.maxSlots, features }),
    });
    const d = await r.json();
    if (d.success) { toast('Service publié !'); setSrvForm({ id: '', name: '', icon: '', gradient: '', price: '', original: '', tagline: '', maxSlots: '', features: '' }); loadAll(); }
    else toast('Erreur : ' + d.error);
  };

  const saveService = async (svc: Service) => {
    const r = await fetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_service', id: svc.id, name: svc.name, icon: svc.icon, gradient: svc.gradient, price: svc.price, original: svc.original, tagline: svc.tagline, maxSlots: svc.maxSlots, features: svc.features }),
    });
    const d = await r.json();
    if (d.success) { toast(`Service ${svc.name} sauvegardé !`); loadAll(); }
  };

  const toggleService = async (id: string, active: boolean) => {
    await fetch('/api/admin/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_service', id, active }),
    });
    loadAll();
  };

  const deleteService = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement le service « ${name} » ? Tous les stocks associés seront aussi perdus.`)) return;
    const r = await fetch(`/api/admin/stock?id=${id}&type=service`, { method: 'DELETE' });
    const d = await r.json();
    if (d.success) { toast('Service supprimé.'); loadAll(); }
    else toast('Erreur : ' + (d.error || 'suppression impossible'));
  };

  /* ─── Settings ────────────────────────────────────────────────────────── */
  const saveSettings = async () => {
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const r = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: updates }),
    });
    const d = await r.json();
    if (d.success) toast('Paramètres sauvegardés !');
    else toast('Erreur lors de la sauvegarde.');
  };

  /* ─── LOGIN SCREEN ────────────────────────────────────────────────────── */
  if (!authed) {
    return (
      <div className="admin-login-wrap">
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, hsla(262,88%,64%,0.25), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '12%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, hsla(190,95%,50%,0.18), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div className="glass-panel admin-login-card">
          <div className="admin-login-icon">SM</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
            Panel <span className="gradient-text">Administrateur</span>
          </h2>
          <p style={{ color: 'var(--text-gray)', fontSize: '0.88rem', marginBottom: 28 }}>
            Connectez-vous pour superviser la plateforme StreamMalin.
          </p>

          <form onSubmit={doLogin} style={{ textAlign: 'left' }}>
            <div className="form-field">
              <label className="form-label">Mot de passe administrateur</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="dash-input"
                required
                autoFocus
              />
            </div>
            {loginError && <div className="error-box">⚠️ {loginError}</div>}
            <button type="submit" className="btn-pay">🔐 Connexion sécurisée</button>
          </form>

          <div style={{ marginTop: 22, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            🛡️ Cette zone est réservée aux administrateurs. Toutes les actions sont journalisées.
          </div>
        </div>
      </div>
    );
  }

  /* ─── ADMIN UI ─────────────────────────────────────────────────────────── */
  const allStocks = services.flatMap(s => s.stocks.map(st => ({ ...st, serviceName: s.name, serviceIcon: s.icon, serviceGradient: s.gradient })));

  const navItems: [AdminPage, string, string][] = [
    ['dashboard', '📊', 'Tableau de bord'],
    ['stocks', '📦', 'Gestion des Stocks'],
    ['services', '🎬', 'Gestion des Services'],
    ['clients', '👥', 'Utilisateurs & Clients'],
    ['settings', '⚙️', 'Paramètres globaux'],
  ];

  return (
    <div>
      <div id="sm-toast" className="toast-box" style={{ display: 'none' }} />

      {/* Topbar */}
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <a href="/" className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span className="gradient-text">StreamMalin</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="admin-topbar-status">
              <span className="hero-badge-dot" style={{ width: 6, height: 6 }} />
              MODE SUPER-ADMIN
            </div>
            <button onClick={doLogout} className="btn btn-danger btn-sm">
              Déconnexion ↩
            </button>
          </div>
        </div>
      </header>

      <div className="admin-shell">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title">Navigation</div>
          {navItems.map(([page, icon, label]) => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`dash-sidebar-btn ${activePage === page ? 'active' : ''}`}
            >
              <span style={{ fontSize: '1.05rem' }}>{icon}</span> {label}
            </button>
          ))}

          <div className="dash-sidebar-divider" />

          <a href="/" className="dash-sidebar-btn">
            <span style={{ fontSize: '1.05rem' }}>🏠</span> Retour au site
          </a>

          <div className="dash-sidebar-foot" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-soft)', fontWeight: 600 }}>
              🛡️ Sécurité
            </div>
            Session admin chiffrée httpOnly. Toutes les actions sont journalisées.
          </div>
        </aside>

        {/* Main */}
        <main className="admin-main">
          {/* Ambient */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, hsla(262,88%,64%,0.1), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

          {/* ── DASHBOARD ── */}
          {activePage === 'dashboard' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <div className="eyebrow">📊 Vue d&apos;ensemble</div>
                <h1>Tableau de bord <span className="gradient-text">temps réel</span></h1>
                <p>Pilotez la santé financière et l&apos;activité de la plateforme.</p>
              </div>

              {/* KPI */}
              <div className="kpi-grid fade-in-up-stagger">
                <div className="glass-panel kpi-card" style={{ ['--accent-color' as any]: 'linear-gradient(90deg, hsl(145,80%,48%), hsl(170,80%,50%))' }}>
                  <div className="kpi-label">Chiffre d&apos;affaires brut</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{fmt(kpis.totalRevenue)}</div>
                  <div className="kpi-sub">↑ Total des abonnements loués</div>
                </div>
                <div className="glass-panel kpi-card" style={{ ['--accent-color' as any]: 'linear-gradient(90deg, hsl(355,85%,58%), hsl(20,85%,58%))' }}>
                  <div className="kpi-label">Coût de revient (COGS)</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>{fmt(kpis.totalInvestment)}</div>
                  <div className="kpi-sub">↓ Achats des comptes à l&apos;étranger</div>
                </div>
                <div className="glass-panel kpi-card" style={{ ['--accent-color' as any]: 'var(--gradient-aurora)' }}>
                  <div className="kpi-label">Bénéfice net réel</div>
                  <div className="kpi-value gradient-text">{fmt(kpis.netProfit)}</div>
                  <div className="kpi-sub">↑ Marge nette cumulée</div>
                </div>
                <div className="glass-panel kpi-card" style={{ ['--accent-color' as any]: 'linear-gradient(90deg, hsl(42,100%,58%), hsl(36,100%,55%))' }}>
                  <div className="kpi-label">Taux de marge</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-yellow)' }}>{kpis.marginPercentage.toFixed(1).replace('.', ',')}%</div>
                  <div className="kpi-sub">📊 Rentabilité globale</div>
                </div>
              </div>

              {/* Chart */}
              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">📈</div>
                  Bénéfices nets — 7 derniers jours
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Actualisé en direct
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, padding: '0 4px' }}>
                  {chartData.map((day, i) => {
                    const h = Math.max((day.profit / maxProfit) * 100, day.profit > 0 ? 5 : 2);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-gray)', fontWeight: 600 }}>
                          {day.profit > 0 ? fmt(day.profit) : '—'}
                        </div>
                        <div style={{
                          width: '100%',
                          height: `${h}%`,
                          minHeight: 4,
                          background: 'var(--gradient-aurora)',
                          borderRadius: '8px 8px 4px 4px',
                          boxShadow: '0 4px 16px rgba(138,92,247,0.3)',
                          transition: 'height 0.4s ease',
                        }} />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{day.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent orders */}
              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">🕐</div>
                  Historique récent des commandes
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Client</th>
                        <th style={{ textAlign: 'right' }}>Net</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>Aucune transaction pour le moment.</td></tr>
                      ) : orders.slice(0, 15).map(o => (
                        <tr key={o.id}>
                          <td style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.78rem', color: 'var(--secondary)' }}>{o.id.slice(0, 8)}</td>
                          <td style={{ color: 'var(--text-gray)' }}>{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                          <td><span style={{ marginRight: 6 }}>{o.service.icon}</span>{o.service.name}</td>
                          <td style={{ color: 'var(--text-gray)', fontSize: '0.78rem' }}>{o.clientEmail}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(o.price)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--secondary)', fontWeight: 800 }}>{fmt(o.total)}</td>
                          <td><span className="badge-pill success">● Actif</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── STOCKS ── */}
          {activePage === 'stocks' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <div className="eyebrow">📦 Inventaire</div>
                <h1>Gestion des <span className="gradient-text">stocks B2C</span></h1>
                <p>Comptes premium achetés à l&apos;étranger, mis en location auprès des clients.</p>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">➕</div>
                  Ajouter un compte de stock
                </div>
                <p className="admin-card-sub">Renseignez le service, le coût d&apos;achat, le prix de location et les identifiants.</p>

                <form onSubmit={addStock}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label">Service <span className="required">*</span></label>
                      <select
                        required
                        value={stockForm.serviceId}
                        onChange={e => setStockForm(f => ({ ...f, serviceId: e.target.value }))}
                        className="dash-input"
                      >
                        <option value="">— Choisir un service —</option>
                        {services.filter(s => s.active).map(s => (
                          <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label">Prix location mensuel (€) <span className="required">*</span></label>
                      <input type="number" step="0.01" required placeholder="3.49" value={stockForm.price}
                        onChange={e => setStockForm(f => ({ ...f, price: e.target.value }))}
                        className="dash-input" />
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label">Places (max slots) <span className="required">*</span></label>
                      <input type="number" required min="1" placeholder="5" value={stockForm.maxSlots}
                        onChange={e => setStockForm(f => ({ ...f, maxSlots: e.target.value }))}
                        className="dash-input" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Accès sécurisés (identifiants ou lien d&apos;invitation) <span className="required">*</span></label>
                    <textarea
                      required
                      rows={3}
                      placeholder="email@example.com / motdepasse (Profil 3) OU Lien famille Google"
                      value={stockForm.details}
                      onChange={e => setStockForm(f => ({ ...f, details: e.target.value }))}
                      className="dash-input"
                      style={{ resize: 'vertical', minHeight: 80 }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">⚡ Enregistrer ce compte en stock</button>
                </form>
              </div>

              <div className="glass-panel admin-card">
                <div className="admin-card-head">
                  <div className="icon-bubble">📋</div>
                  Comptes en stock actuellement
                  <span className="badge-pill neutral" style={{ marginLeft: 'auto' }}>
                    {allStocks.length} compte{allStocks.length > 1 ? 's' : ''}
                  </span>
                </div>

                {allStocks.length === 0 ? (
                  <div className="dash-empty" style={{ padding: '40px 20px' }}>
                    <div className="dash-empty-icon">📭</div>
                    <h3>Aucun compte en stock</h3>
                    <p>Ajoutez votre premier compte ci-dessus pour commencer la location.</p>
                  </div>
                ) : (
                  allStocks.map(st => (
                    <div key={st.id} className="stock-item">
                      <div className="stock-icon-lg" style={{ background: (st as any).serviceGradient }}>
                        {(st as any).serviceIcon}
                      </div>
                      <div className="stock-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-white)' }}>{(st as any).serviceName}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'SF Mono',Menlo,monospace" }}>#{st.id.slice(0, 8)}</span>
                          {st.filledSlots >= st.maxSlots && <span className="badge-pill warn">Complet</span>}
                        </div>
                        <div className="stock-info-row">
                          <span>Location : <strong>{fmt(st.price)}/mois</strong></span>
                          <span>·</span>
                          <span>Remplissage : <strong>{st.filledSlots}/{st.maxSlots}</strong></span>
                          {st.filledSlots < st.maxSlots && <><span>·</span><span style={{ color: 'var(--accent-green)' }}><strong>{st.maxSlots - st.filledSlots} slot{st.maxSlots - st.filledSlots > 1 ? 's' : ''} libre{st.maxSlots - st.filledSlots > 1 ? 's' : ''}</strong></span></>}
                        </div>
                        <div className="stock-creds">🔑 {st.details}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setEditStock(st)} className="btn btn-primary btn-sm">📝 Modifier</button>
                        <button onClick={() => deleteStock(st.id)} className="btn btn-danger btn-sm">❌ Retirer</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Edit modal */}
              {editStock && (
                <div className="modal-overlay" onClick={() => setEditStock(null)}>
                  <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
                    <div className="admin-card-head">
                      <div className="icon-bubble">📝</div>
                      Modifier le compte en stock
                    </div>
                    <form onSubmit={saveStock}>
                      <div className="info-box" style={{ marginBottom: 14 }}>
                        <div className="info-box-title">🔄 Mettre à jour les identifiants</div>
                        <div className="info-box-text">Si un client a résilié, modifiez l&apos;email/mot de passe ci-dessous et décrémentez « Places occupées » pour libérer un slot.</div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        <div className="form-field">
                          <label className="form-label">Prix location (€)</label>
                          <input type="number" step="0.01" required value={editStock.price}
                            onChange={e => setEditStock(s => s ? { ...s, price: +e.target.value } : s)}
                            className="dash-input" />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Places occupées</label>
                          <input type="number" required min="0" value={editStock.filledSlots}
                            onChange={e => setEditStock(s => s ? { ...s, filledSlots: +e.target.value } : s)}
                            className="dash-input" />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Places max</label>
                          <input type="number" required min="1" value={editStock.maxSlots}
                            onChange={e => setEditStock(s => s ? { ...s, maxSlots: +e.target.value } : s)}
                            className="dash-input" />
                        </div>
                      </div>
                      <div className="form-field">
                        <label className="form-label">🔑 Email / Mot de passe / Lien d&apos;invitation</label>
                        <textarea rows={4} required value={editStock.details}
                          onChange={e => setEditStock(s => s ? { ...s, details: e.target.value } : s)}
                          className="dash-input"
                          placeholder="email@example.com / motdepasse (Profil 3)"
                          style={{ resize: 'vertical', minHeight: 100, fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.85rem' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>💾 Sauvegarder</button>
                        <button type="button" onClick={() => setEditStock(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SERVICES ── */}
          {activePage === 'services' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <div className="eyebrow">🎬 Catalogue</div>
                <h1>Configuration des <span className="gradient-text">services & tarifs</span></h1>
                <p>Créez, modifiez ou désactivez les services proposés sur la marketplace.</p>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">➕</div>
                  Créer un nouveau service
                </div>

                <form onSubmit={createService}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
                    {[
                      { label: 'Identifiant (minuscules)', key: 'id', placeholder: 'netflix' },
                      { label: 'Nom du service', key: 'name', placeholder: 'Netflix Premium' },
                      { label: 'Icône / Emoji', key: 'icon', placeholder: '🍿' },
                      { label: 'Prix location (€)', key: 'price', placeholder: '4.99', type: 'number' },
                      { label: 'Tarif public (€)', key: 'original', placeholder: '19.99', type: 'number' },
                      { label: 'Phrase d\'accroche', key: 'tagline', placeholder: 'Séries et films Ultra HD' },
                      { label: 'Places max', key: 'maxSlots', placeholder: '4', type: 'number' },
                    ].map(f => (
                      <div key={f.key} className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">{f.label} <span className="required">*</span></label>
                        <input
                          type={f.type || 'text'}
                          step={f.type === 'number' ? '0.01' : undefined}
                          required
                          placeholder={f.placeholder}
                          value={(srvForm as any)[f.key]}
                          onChange={e => setSrvForm(form => ({ ...form, [f.key]: e.target.value }))}
                          className="dash-input"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Fonctionnalités clés (séparées par virgules) <span className="required">*</span></label>
                    <input
                      type="text" required
                      placeholder="Ultra HD 4K, Profil dédié, Téléchargement hors-ligne"
                      value={srvForm.features}
                      onChange={e => setSrvForm(f => ({ ...f, features: e.target.value }))}
                      className="dash-input"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">🎬 Publier le service</button>
                </form>
              </div>

              <div className="glass-panel admin-card">
                <div className="admin-card-head">
                  <div className="icon-bubble">📚</div>
                  Catalogue actuel
                  <span className="badge-pill neutral" style={{ marginLeft: 'auto' }}>
                    {services.length} service{services.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="admin-card-sub">Ajustez les prix, descriptions et le statut d&apos;activation.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {services.map(svc => (
                    <ServiceEditCard key={svc.id} svc={svc} onSave={saveService} onToggle={toggleService} onDelete={deleteService} onEditStock={setEditStock} onAddStock={addStockInline} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CLIENTS ── */}
          {activePage === 'clients' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <div className="eyebrow">👥 Base clients</div>
                <h1>Utilisateurs & <span className="gradient-text">clients</span></h1>
                <p>Profils dérivés des commandes — historique et CA par client.</p>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">💾</div>
                  Base de données clients
                  <span className="badge-pill neutral" style={{ marginLeft: 'auto' }}>
                    {clients.length} client{clients.length > 1 ? 's' : ''}
                  </span>
                </div>

                {clients.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">👤</div>
                    <h3>Aucun client enregistré</h3>
                    <p>Les clients apparaîtront ici après leur première commande.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Email</th>
                          <th>1ère commande</th>
                          <th style={{ textAlign: 'center' }}>Commandes</th>
                          <th style={{ textAlign: 'center' }}>Actifs</th>
                          <th style={{ textAlign: 'right' }}>Total dépensé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.map((c, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#fff', background: 'var(--gradient-aurora)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                                {c.email[0].toUpperCase()}
                              </div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{c.email}</td>
                            <td style={{ color: 'var(--text-gray)' }}>{c.firstOrderDate}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge-pill neutral">{c.orderCount}</span></td>
                            <td style={{ textAlign: 'center' }}><span className="badge-pill success">{c.activeOrders}</span></td>
                            <td style={{ textAlign: 'right', color: 'var(--secondary)', fontWeight: 800 }}>{fmt(c.totalSpent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activePage === 'settings' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <div className="eyebrow">⚙️ Configuration</div>
                <h1>Paramètres <span className="gradient-text">globaux</span></h1>
                <p>Passerelles de paiement, portefeuilles crypto et options de plateforme.</p>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">💰</div>
                  Mode de facturation B2C
                </div>
                <p className="admin-card-sub">
                  Vente directe d&apos;accès premium. Prix nets, sans commissions cachées.
                </p>
                <div className="info-box" style={{ background: 'rgba(0,230,118,0.06)', borderColor: 'rgba(0,230,118,0.2)' }}>
                  <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>🛡️ Prix plat garanti</div>
                  <div className="info-box-text">
                    Frais de plateforme / Commissions : <strong style={{ color: 'var(--accent-green)' }}>0,00€</strong>. Tous les revenus restent pour StreamMalin.
                  </div>
                </div>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">💳</div>
                  Moyens de paiement actifs
                </div>
                {[
                  { key: 'gateway_cb', label: 'Carte Bancaire', sub: 'Via Stripe 3D Secure', icon: '💳' },
                  { key: 'gateway_paypal', label: 'PayPal Checkout', sub: 'Mode Biens & Services uniquement', icon: '🅿️' },
                  { key: 'gateway_crypto', label: 'Cryptomonnaies', sub: 'BTC, ETH, USDT, LTC', icon: '₿' },
                ].map(g => {
                  const on = settings[g.key] !== 'false';
                  return (
                    <div key={g.key} className="toggle-row">
                      <span style={{ fontSize: '1.4rem' }}>{g.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div className="toggle-row-label">{g.label}</div>
                        <div className="toggle-row-sub">{g.sub}</div>
                      </div>
                      <span className="badge-pill" style={{ background: on ? 'rgba(0,230,118,0.13)' : 'rgba(255,255,255,0.06)', color: on ? 'var(--accent-green)' : 'var(--text-muted)', border: `1px solid ${on ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                        {on ? '● Actif' : '○ Inactif'}
                      </span>
                      <button
                        onClick={() => setSettings(s => ({ ...s, [g.key]: on ? 'false' : 'true' }))}
                        className={`toggle ${on ? 'on' : ''}`}
                        aria-label={`Toggle ${g.label}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">₿</div>
                  Portefeuilles crypto de réception
                </div>
                <p className="admin-card-sub">Adresses publiques affichées aux clients lors du checkout crypto.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {[
                    { key: 'crypto_btc', label: 'Bitcoin (BTC)', color: '#F7931A', symbol: '₿' },
                    { key: 'crypto_eth', label: 'Ethereum (ETH)', color: '#627EEA', symbol: '⟠' },
                    { key: 'crypto_usdt', label: 'USDT (TRC20)', color: '#26A17B', symbol: '₮' },
                    { key: 'crypto_ltc', label: 'Litecoin (LTC)', color: '#345D9D', symbol: 'Ł' },
                  ].map(c => (
                    <div key={c.key} className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.color, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', fontWeight: 700 }}>
                        <span style={{ fontSize: '1.2rem' }}>{c.symbol}</span> {c.label}
                      </label>
                      <input
                        type="text"
                        placeholder={`Adresse ${c.label.split(' ')[0]}…`}
                        value={settings[c.key] || ''}
                        onChange={e => setSettings(s => ({ ...s, [c.key]: e.target.value }))}
                        className="dash-input"
                        style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.82rem' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={saveSettings} className="btn btn-primary btn-lg">
                  💾 Sauvegarder tous les paramètres
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── ServiceEditCard (inline editable) ─────────────────────────────────── */
function ServiceEditCard({ svc, onSave, onToggle, onDelete, onEditStock, onAddStock }: {
  svc: Service;
  onSave: (svc: Service) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string, name: string) => void;
  onEditStock: (st: StockAccount) => void;
  onAddStock: (serviceId: string, price: string, maxSlots: string, details: string) => Promise<boolean>;
}) {
  const [local, setLocal] = useState(svc);
  const [addPrice, setAddPrice] = useState('');
  const [addSlots, setAddSlots] = useState('');
  const [addDetails, setAddDetails] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => { setLocal(svc); }, [svc]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPrice || !addSlots || !addDetails) return;
    setAdding(true);
    const ok = await onAddStock(svc.id, addPrice, addSlots, addDetails);
    setAdding(false);
    if (ok) { setAddPrice(''); setAddSlots(''); setAddDetails(''); }
  };

  return (
    <div className="glass-panel svc-edit-card">
      <h4>
        <span style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', background: svc.gradient, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
          {svc.icon}
        </span>
        {svc.name}
        <span className="badge-pill" style={{ marginLeft: 'auto', background: local.active ? 'rgba(0,230,118,0.13)' : 'rgba(255,255,255,0.06)', color: local.active ? 'var(--accent-green)' : 'var(--text-muted)', border: `1px solid ${local.active ? 'rgba(0,230,118,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
          {local.active ? '● Actif' : '○ Inactif'}
        </span>
      </h4>

      <div className="form-field">
        <label className="form-label">Nom affiché</label>
        <input type="text" value={local.name} onChange={e => setLocal(l => ({ ...l, name: e.target.value }))}
          className="dash-input" />
      </div>
      <div className="form-field">
        <label className="form-label">Phrase d&apos;accroche</label>
        <input type="text" value={local.tagline} onChange={e => setLocal(l => ({ ...l, tagline: e.target.value }))}
          className="dash-input" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-field">
          <label className="form-label">Prix (€)</label>
          <input type="number" step="0.01" value={local.price} onChange={e => setLocal(l => ({ ...l, price: +e.target.value }))}
            className="dash-input" />
        </div>
        <div className="form-field">
          <label className="form-label">Public (€)</label>
          <input type="number" step="0.01" value={local.original} onChange={e => setLocal(l => ({ ...l, original: +e.target.value }))}
            className="dash-input" />
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Places max</label>
        <input type="number" value={local.maxSlots} onChange={e => setLocal(l => ({ ...l, maxSlots: +e.target.value }))}
          className="dash-input" />
      </div>

      <div className="toggle-row" style={{ marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div className="toggle-row-label">Actif au catalogue</div>
          <div className="toggle-row-sub">Visible sur la boutique publique</div>
        </div>
        <button
          onClick={() => { setLocal(l => ({ ...l, active: !l.active })); onToggle(svc.id, !local.active); }}
          className={`toggle ${local.active ? 'on' : ''}`}
        />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
          🔑 Comptes en stock ({svc.stocks?.length || 0})
        </div>

        {svc.stocks && svc.stocks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {svc.stocks.map(st => (
              <div key={st.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'SF Mono',Menlo,monospace" }}>
                    #{st.id.slice(0, 6)} · {st.filledSlots}/{st.maxSlots} slots
                  </span>
                  <button onClick={() => onEditStock(st)} className="btn btn-primary btn-sm" style={{ padding: '5px 10px', fontSize: '0.74rem' }}>
                    📝 Modifier identifiants
                  </button>
                </div>
                <div style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.74rem', color: 'var(--text-gray)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {st.details.length > 60 ? st.details.slice(0, 60) + '…' : st.details}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulaire d'ajout inline */}
        <form onSubmit={handleAdd} style={{ background: 'rgba(168,85,247,0.06)', border: '1px dashed rgba(168,85,247,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', marginBottom: 8 }}>
            ➕ Ajouter un compte de stock
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="number" step="0.01" required placeholder="Prix (€)" value={addPrice}
              onChange={e => setAddPrice(e.target.value)} className="dash-input"
              style={{ fontSize: '0.78rem', padding: '7px 9px' }} />
            <input type="number" required min="1" placeholder="Places max" value={addSlots}
              onChange={e => setAddSlots(e.target.value)} className="dash-input"
              style={{ fontSize: '0.78rem', padding: '7px 9px' }} />
          </div>
          <textarea required rows={2} placeholder="Identifiants : email@example.com / motdepasse" value={addDetails}
            onChange={e => setAddDetails(e.target.value)} className="dash-input"
            style={{ resize: 'vertical', minHeight: 50, fontSize: '0.78rem', padding: '7px 9px', marginBottom: 8, fontFamily: "'SF Mono',Menlo,monospace" }} />
          <button type="submit" disabled={adding} className="btn btn-primary btn-sm" style={{ width: '100%', fontSize: '0.78rem' }}>
            {adding ? '⏳ Ajout…' : '⚡ Enregistrer ce compte'}
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <button onClick={() => onSave(local)} className="btn btn-primary">
          💾 Sauvegarder
        </button>
        <button onClick={() => onDelete(svc.id, svc.name)} className="btn btn-danger">
          🗑 Supprimer
        </button>
      </div>
    </div>
  );
}
