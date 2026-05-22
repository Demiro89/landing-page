'use client';

import React, { useState, useEffect } from 'react';
import { SERVICE_CATALOG, CATALOG_CATEGORIES, type ServicePreset } from '@/lib/serviceCatalog';

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
  clientEmail: string; youtubeEmail?: string | null; status: string; details: string;
  serviceId: string;
  stockAccountId: string;
  paymentMethod?: string | null;
  acceptanceIp?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationEffectiveAt?: string | null;
  unpaidSince?: string | null;
  reminderCount?: number;
  lastReminderAt?: string | null;
  nextBillingAt?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  service: { name: string; icon: string; gradient?: string };
  stockAccount: { accountsBoughtPrice: number };
}
interface Kpis {
  totalRevenue: number; totalCogs: number; totalInvestment: number;
  netProfit: number; marginPercentage: number;
}
interface SupportMessage {
  id: string; sender: string; text: string; createdAt: string;
}
interface SupportThread {
  id: string; orderId: string; title: string; createdAt: string;
  messages: SupportMessage[];
  order: { clientEmail: string; service: { name: string; icon: string; gradient: string } };
}
interface Client {
  email: string; firstOrderDate: string; orderCount: number;
  totalSpent: number; activeOrders: number;
}
interface Settings { [key: string]: string }

type AdminPage = 'dashboard' | 'pending' | 'stocks' | 'services' | 'subscribers' | 'clients' | 'unpaid' | 'cancellations' | 'support' | 'settings';

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
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [activePage, setActivePage] = useState<AdminPage>('dashboard');

  // Double authentification (2FA / TOTP)
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);

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
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [srvForm, setSrvForm] = useState({ id: '', name: '', icon: '', gradient: '', price: '', original: '', tagline: '', maxSlots: '', features: '' });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCat, setCatalogCat] = useState<string>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogBusy, setCatalogBusy] = useState<string | null>(null);

  // Support chat
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [activeSupportThread, setActiveSupportThread] = useState<string | null>(null);
  const [supportInput, setSupportInput] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const supportBottomRef = React.useRef<HTMLDivElement>(null);
  const supportPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

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
      body: JSON.stringify({ password, totp: totpCode || undefined }),
    });
    const d = await r.json();
    if (d.success) { setAuthed(true); setNeedsTotp(false); setTotpCode(''); loadAll(); return; }
    if (d.needsTotp) {
      setNeedsTotp(true);
      setLoginError(totpCode ? 'Code de vérification incorrect.' : '');
      return;
    }
    setLoginError('Mot de passe incorrect. Veuillez réessayer.');
  };

  const doLogout = async () => {
    await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setAuthed(false);
  };

  /* ─── Data ────────────────────────────────────────────────────────────── */
  const loadAll = async () => {
    const [stockRes, clientRes, settRes, twoFaRes] = await Promise.all([
      fetch('/api/admin/stock').then(r => r.json()),
      fetch('/api/admin/clients').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
      fetch('/api/admin/2fa').then(r => r.json()).catch(() => ({})),
    ]);
    if (stockRes.success) { setServices(stockRes.services); setOrders(stockRes.orders); setKpis(stockRes.kpis); }
    if (clientRes.success) setClients(clientRes.clients);
    if (settRes.success) setSettings(settRes.settings);
    if (twoFaRes.success) setTwoFaEnabled(twoFaRes.enabled);
  };

  /* ─── 2FA (TOTP) ──────────────────────────────────────────────────────── */
  const start2faSetup = async () => {
    setTwoFaBusy(true);
    try {
      const r = await fetch('/api/admin/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      const d = await r.json();
      if (d.success) { setTwoFaSetup({ secret: d.secret, uri: d.uri }); setTwoFaCode(''); }
      else toast(d.error || 'Erreur');
    } finally { setTwoFaBusy(false); }
  };

  const confirm2fa = async () => {
    if (!twoFaSetup) return;
    setTwoFaBusy(true);
    try {
      const r = await fetch('/api/admin/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', secret: twoFaSetup.secret, token: twoFaCode }),
      });
      const d = await r.json();
      if (d.success) { setTwoFaEnabled(true); setTwoFaSetup(null); setTwoFaCode(''); toast('Double authentification activée !'); }
      else toast(d.error || 'Code incorrect');
    } finally { setTwoFaBusy(false); }
  };

  const disable2fa = async () => {
    setTwoFaBusy(true);
    try {
      const r = await fetch('/api/admin/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', token: twoFaCode }),
      });
      const d = await r.json();
      if (d.success) { setTwoFaEnabled(false); setTwoFaCode(''); toast('Double authentification désactivée'); }
      else toast(d.error || 'Code incorrect');
    } finally { setTwoFaBusy(false); }
  };

  /* ─── Validation des commandes manuelles (PayPal / crypto) ────────────── */
  const validateOrder = async (orderId: string) => {
    if (!confirm('Valider cette commande ? Les identifiants seront livrés au client par email.')) return;
    const r = await fetch('/api/admin/stock', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate_order', orderId }),
    });
    const d = await r.json();
    if (d.success) { toast('Commande validée et livrée !'); loadAll(); }
    else toast(d.error || 'Erreur');
  };

  const rejectOrder = async (orderId: string) => {
    if (!confirm('Refuser cette commande en attente ?')) return;
    const r = await fetch('/api/admin/stock', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject_order', orderId }),
    });
    const d = await r.json();
    if (d.success) { toast('Commande refusée'); loadAll(); }
    else toast(d.error || 'Erreur');
  };

  const loadSupportThreads = async () => {
    const r = await fetch('/api/chat');
    const d = await r.json();
    if (d.success) setSupportThreads(d.threads);
  };

  React.useEffect(() => {
    if (activePage === 'support') {
      loadSupportThreads();
      supportPollRef.current = setInterval(loadSupportThreads, 5000);
    } else {
      if (supportPollRef.current) clearInterval(supportPollRef.current);
    }
    return () => { if (supportPollRef.current) clearInterval(supportPollRef.current); };
  }, [activePage]);

  React.useEffect(() => {
    supportBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSupportThread, supportThreads]);

  const sendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportInput.trim() || !activeSupportThread || sendingSupport) return;
    setSendingSupport(true);
    const text = supportInput.trim();
    setSupportInput('');
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: activeSupportThread, text, sender: 'Support StreamMalin' }),
    });
    await loadSupportThreads();
    setSendingSupport(false);
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

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    const r = await fetch('/api/admin/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_order',
        orderId: editOrder.id,
        clientEmail: editOrder.clientEmail,
        youtubeEmail: editOrder.youtubeEmail || '',
      }),
    });
    const d = await r.json();
    if (d.success) { toast('Informations client mises à jour !'); setEditOrder(null); loadAll(); }
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

  const fillFromPreset = (p: ServicePreset) => {
    setSrvForm({
      id: uniqueServiceId(p.id), name: p.name, icon: p.icon, gradient: p.gradient,
      price: String(p.price), original: String(p.original),
      tagline: p.tagline, maxSlots: String(p.maxSlots),
      features: p.features.join(', '),
    });
    setCatalogOpen(false);
    toast(`« ${p.name} » chargé dans le formulaire`);
  };

  const uniqueServiceId = (base: string) => {
    if (!services.some(s => s.id === base)) return base;
    let n = 2;
    while (services.some(s => s.id === `${base}-${n}`)) n++;
    return `${base}-${n}`;
  };

  const publishPreset = async (p: ServicePreset) => {
    const id = uniqueServiceId(p.id);
    setCatalogBusy(p.id);
    try {
      const r = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_service', id, name: p.name, icon: p.icon, gradient: p.gradient, price: p.price, original: p.original, tagline: p.tagline, maxSlots: p.maxSlots, features: p.features }),
      });
      const d = await r.json();
      if (d.success) { toast(`Service « ${p.name} » publié !`); loadAll(); }
      else toast('Erreur : ' + d.error);
    } finally {
      setCatalogBusy(null);
    }
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
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, hsla(258,90%,66%,0.25), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '12%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, hsla(239,84%,67%,0.18), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

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
            {needsTotp && (
              <div className="form-field">
                <label className="form-label">Code de vérification (2FA)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="dash-input"
                  required
                  autoFocus
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Saisissez le code à 6 chiffres de votre application d&apos;authentification.
                </div>
              </div>
            )}
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
    ['pending', '🕓', 'Commandes à valider'],
    ['stocks', '📦', 'Gestion des Stocks'],
    ['services', '🎬', 'Gestion des Services'],
    ['subscribers', '🎫', 'Abonnés par service'],
    ['clients', '👥', 'Utilisateurs & Clients'],
    ['unpaid', '⚠️', 'Impayés'],
    ['cancellations', '🔴', 'Résiliations'],
    ['support', '💬', 'Support Client'],
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
          <div style={{ position: 'absolute', top: 0, right: 0, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, hsla(258,90%,66%,0.1), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

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
                          <td style={{ color: 'var(--text-gray)', fontSize: '0.78rem' }}>
                            {o.clientEmail}
                            {o.youtubeEmail && (
                              <div style={{ fontSize: '0.72rem', color: '#ff4444', marginTop: 2 }}>
                                ▶ YT: <strong style={{ color: 'var(--text-white)' }}>{o.youtubeEmail}</strong>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmt(o.price)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--secondary)', fontWeight: 800 }}>{fmt(o.total)}</td>
                          <td>
                            {o.status === 'unpaid'
                              ? <span className="badge-pill" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>⚠️ Impayé</span>
                              : o.status === 'cancelled_pending'
                              ? <span className="badge-pill" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>🔴 Résiliation</span>
                              : o.status === 'cancelled'
                              ? <span className="badge-pill neutral">✕ Résilié</span>
                              : <span className="badge-pill success">● Actif</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── COMMANDES À VALIDER ── */}
          {activePage === 'pending' && (() => {
            const pending = orders.filter(o => o.status === 'pending');
            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <div className="eyebrow">🕓 Validation</div>
                  <h1>Commandes <span className="gradient-text">à valider</span></h1>
                  <p>Paiements PayPal et crypto enregistrés, en attente de votre vérification.</p>
                </div>

                {pending.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">✅</div>
                    <p>Aucune commande en attente. Les paiements PayPal et crypto apparaîtront ici.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pending.map(o => (
                      <div key={o.id} className="glass-panel admin-card fade-in-up">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', background: o.service?.gradient || 'rgba(255,255,255,0.06)' }}>
                            {o.service?.icon}
                          </span>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontWeight: 800 }}>{o.service?.name || o.serviceId}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.clientEmail}</div>
                          </div>
                          <span className="badge-pill" style={{ background: 'rgba(245,158,11,0.13)', color: 'var(--accent-yellow)', border: '1px solid rgba(245,158,11,0.25)' }}>
                            {o.paymentMethod || 'Paiement manuel'}
                          </span>
                          <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>{o.total.toFixed(2)}€</span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 10, fontFamily: "'SF Mono',Menlo,monospace", lineHeight: 1.7 }}>
                          Réf. {o.id.slice(0, 8).toUpperCase()} · {new Date(o.date).toLocaleString('fr-FR')}
                          {o.acceptanceIp ? ` · CGV acceptées depuis ${o.acceptanceIp}` : ''}
                          {o.youtubeEmail ? ` · YouTube : ${o.youtubeEmail}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => validateOrder(o.id)} className="btn btn-primary btn-sm">
                            ✅ Valider &amp; livrer
                          </button>
                          <button onClick={() => rejectOrder(o.id)} className="btn btn-danger btn-sm">
                            ✕ Refuser
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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
                  <button
                    type="button"
                    onClick={() => { setCatalogOpen(true); setCatalogSearch(''); setCatalogCat('all'); }}
                    className="btn btn-primary btn-sm"
                    style={{ marginLeft: 'auto' }}
                  >
                    📚 Catalogue ({SERVICE_CATALOG.length} services)
                  </button>
                </div>

                <div className="info-box" style={{ marginBottom: 14 }}>
                  <div className="info-box-title">💡 Astuce</div>
                  <div className="info-box-text">
                    Ouvrez le <strong>catalogue</strong> pour ajouter en 1 clic un service parmi {SERVICE_CATALOG.length} préréglages (Netflix, Spotify, ChatGPT, NordVPN…), ou pré-remplissez le formulaire pour ajuster les tarifs avant publication.
                  </div>
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

          {/* ── ABONNÉS PAR SERVICE & COMPTE ── */}
          {activePage === 'subscribers' && (() => {
            const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'unpaid' || o.status === 'cancelled_pending');
            const statusBadge = (st: string) =>
              st === 'unpaid'
                ? <span className="badge-pill" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>⚠️ Impayé</span>
                : st === 'cancelled_pending'
                ? <span className="badge-pill" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>🔴 Résiliation</span>
                : <span className="badge-pill success">● Actif</span>;
            const copyCreds = (txt: string) => { navigator.clipboard.writeText(txt); toast('Identifiants copiés'); };

            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <div className="eyebrow">🎫 Abonnés actifs</div>
                  <h1>Abonnés par <span className="gradient-text">compte</span></h1>
                  <p>Vue regroupée par service puis par compte de stock — qui est sur quel compte précis.</p>
                </div>

                {services.map(service => {
                  const serviceOrders = activeOrders.filter(o => o.serviceId === service.id);
                  const totalSlots = service.stocks.reduce((acc, st) => acc + st.maxSlots, 0);
                  const usedSlots = service.stocks.reduce((acc, st) => acc + st.filledSlots, 0);

                  return (
                    <div key={service.id} className="glass-panel admin-card fade-in-up" style={{ marginBottom: 18 }}>
                      <div className="admin-card-head">
                        <div className="icon-bubble" style={{ background: service.gradient }}>{service.icon}</div>
                        {service.name}
                        <span className="badge-pill neutral" style={{ marginLeft: 'auto' }}>
                          {serviceOrders.length} abonné{serviceOrders.length > 1 ? 's' : ''} · {service.stocks.length} compte{service.stocks.length > 1 ? 's' : ''} · {usedSlots}/{totalSlots} slots
                        </span>
                      </div>

                      {service.stocks.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '12px 0' }}>Aucun compte de stock pour ce service.</p>
                      ) : service.stocks.map((stock, idx) => {
                        const stockOrders = serviceOrders.filter(o => o.stockAccountId === stock.id);
                        return (
                          <div key={stock.id} style={{ marginTop: idx === 0 ? 12 : 18, padding: 14, borderRadius: 12, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-white)', background: 'rgba(168,85,247,0.15)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)' }}>
                                  COMPTE #{idx + 1}
                                </span>
                                <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'SF Mono',Menlo,monospace" }}>{stock.id.slice(0, 8)}</code>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                                  {stock.filledSlots}/{stock.maxSlots} slots occupés · {fmt(stock.price)}/mois
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <code style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 6, color: '#3b82f6', fontFamily: "'SF Mono',Menlo,monospace", maxWidth: 340, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  🔑 {stock.details.length > 50 ? stock.details.slice(0, 50) + '…' : stock.details}
                                </code>
                                <button
                                  onClick={() => copyCreds(stock.details)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                                  title="Copier les identifiants du compte"
                                >📋</button>
                              </div>
                            </div>

                            {stockOrders.length === 0 ? (
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '6px 0 0', fontStyle: 'italic' }}>Aucun abonné sur ce compte.</p>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table className="admin-table" style={{ marginTop: 4 }}>
                                  <thead>
                                    <tr>
                                      <th>Client</th>
                                      <th>Souscrit le</th>
                                      <th>Prochain prélèvement</th>
                                      <th>Carte</th>
                                      <th>Statut</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stockOrders.map(o => (
                                      <tr key={o.id}>
                                        <td style={{ fontSize: '0.82rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontWeight: 700, color: 'var(--text-white)' }}>{o.clientEmail}</div>
                                              {o.youtubeEmail && (
                                                <div style={{ fontSize: '0.72rem', color: '#ff4444', marginTop: 3 }}>
                                                  ▶ YT à inviter : <strong style={{ color: 'var(--text-white)' }}>{o.youtubeEmail}</strong>
                                                </div>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => setEditOrder(o)}
                                              className="btn btn-ghost btn-sm"
                                              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                                              title="Modifier les infos client"
                                            >✏️</button>
                                          </div>
                                        </td>
                                        <td style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
                                          {new Date(o.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td style={{ color: 'var(--text-gray)', fontSize: '0.8rem' }}>
                                          {o.nextBillingAt ? new Date(o.nextBillingAt).toLocaleDateString('fr-FR') : '—'}
                                        </td>
                                        <td style={{ fontSize: '0.78rem' }}>
                                          {o.cardLast4
                                            ? <span style={{ fontFamily: "'SF Mono',Menlo,monospace" }}>{(o.cardBrand || 'CB').toUpperCase()} •••• {o.cardLast4}</span>
                                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>
                                        <td>{statusBadge(o.status)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

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
                            <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {c.email}
                              {orders.some(o => o.clientEmail === c.email && o.status === 'unpaid') && (
                                <span title="Impayé détecté" style={{ padding: '2px 8px', borderRadius: 50, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800, border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap' }}>⚠️ Impayé</span>
                              )}
                            </td>
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

          {/* ── IMPAYÉS ── */}
          {activePage === 'unpaid' && (() => {
            const unpaidOrders = orders.filter(o => o.status === 'unpaid');
            const markUnpaid = async (orderId: string) => {
              await fetch('/api/admin/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_unpaid', orderId }) });
              await loadAll();
              toast('Commande marquée impayée — rappel envoyé');
            };
            const sendReminder = async (orderId: string) => {
              const r = await fetch('/api/admin/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_reminder', orderId }) });
              const d = await r.json();
              await loadAll();
              toast(`Rappel ${d.reminderLevel}/3 envoyé`);
            };
            const markPaid = async (orderId: string) => {
              await fetch('/api/admin/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_paid', orderId }) });
              await loadAll();
              toast('Commande marquée comme payée ✅');
            };
            const cancelAfterUnpaid = async (orderId: string) => {
              if (!confirm('Résilier définitivement cet abonnement pour impayé ?')) return;
              await fetch('/api/admin/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_order', orderId }) });
              await loadAll();
              toast('Abonnement résilié pour impayé');
            };
            const reminderLabels: Record<number, string> = { 1: 'Rappel 1/3 envoyé', 2: 'Rappel 2/3 envoyé', 3: '⚠️ Dernier rappel envoyé' };
            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <div className="eyebrow">⚠️ Paiements</div>
                  <h1>Gestion des <span className="gradient-text">Impayés</span></h1>
                  <p>Signalez un impayé, envoyez des rappels automatiques et résilier si nécessaire.</p>
                </div>

                {/* Marquer une commande impayée */}
                <div className="glass-panel admin-card fade-in-up" style={{ marginBottom: 24 }}>
                  <div className="admin-card-head">
                    <div className="icon-bubble">🔍</div>
                    Signaler un impayé
                  </div>
                  <p className="admin-card-sub">Sélectionnez la commande active concernée. Un premier email de rappel sera automatiquement envoyé au client.</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Client</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Service</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Prix</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.filter(o => o.status === 'active').length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune commande active.</td></tr>
                        ) : orders.filter(o => o.status === 'active').map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '12px', fontWeight: 600 }}>{o.clientEmail}</td>
                            <td style={{ padding: '12px' }}>{o.service.icon} {o.service.name}</td>
                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{fmt(o.price)}/mois</td>
                            <td style={{ padding: '12px' }}>
                              <button onClick={() => markUnpaid(o.id)} className="btn btn-ghost btn-sm" style={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)', fontSize: '0.78rem' }}>
                                ⚠️ Signaler impayé
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Commandes impayées en cours */}
                <div className="glass-panel admin-card fade-in-up">
                  <div className="admin-card-head">
                    <div className="icon-bubble">⚠️</div>
                    Impayés en cours
                    {unpaidOrders.length > 0 && (
                      <span style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 50, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 800 }}>
                        {unpaidOrders.length}
                      </span>
                    )}
                  </div>
                  {unpaidOrders.length === 0 ? (
                    <div className="dash-empty" style={{ borderRadius: 0 }}>
                      <div className="dash-empty-icon">✅</div>
                      <h3>Aucun impayé en cours</h3>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {unpaidOrders.map(o => {
                        const level = o.reminderCount || 1;
                        const daysSince = o.unpaidSince ? Math.floor((Date.now() - new Date(o.unpaidSince).getTime()) / 86400000) : 0;
                        return (
                          <div key={o.id} style={{ padding: 18, borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                              <div>
                                <div style={{ fontWeight: 800, color: 'var(--text-white)', marginBottom: 4 }}>
                                  {o.service.icon} {o.service.name} — <span style={{ color: '#fbbf24' }}>{fmt(o.price)}/mois</span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                  👤 {o.clientEmail} · Impayé depuis {daysSince}j · <span style={{ color: '#fbbf24' }}>{reminderLabels[Math.min(level, 3)]}</span>
                                </div>
                                {o.lastReminderAt && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    Dernier rappel : {new Date(o.lastReminderAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={() => markPaid(o.id)} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-green)', borderColor: 'rgba(16,185,129,0.3)', fontSize: '0.78rem' }}>
                                  ✅ Marquer payé
                                </button>
                                {level < 3 && (
                                  <button onClick={() => sendReminder(o.id)} className="btn btn-ghost btn-sm" style={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)', fontSize: '0.78rem' }}>
                                    🔔 Rappel {level + 1}/3
                                  </button>
                                )}
                                <button onClick={() => cancelAfterUnpaid(o.id)} className="btn btn-ghost btn-sm" style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', fontSize: '0.78rem' }}>
                                  🔴 Résilier
                                </button>
                              </div>
                            </div>
                            {/* Barre de progression des rappels */}
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[1, 2, 3].map(n => (
                                <div key={n} style={{ flex: 1, height: 4, borderRadius: 4, background: n <= level ? '#f59e0b' : 'rgba(255,255,255,0.08)' }} />
                              ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              <span>Rappel 1</span><span>Rappel 2</span><span>Dernier avertissement</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── RÉSILIATIONS ── */}
          {activePage === 'cancellations' && (() => {
            const pending = orders.filter(o => o.status === 'cancelled_pending');
            const cancelled = orders.filter(o => o.status === 'cancelled');
            const confirmCancel = async (orderId: string) => {
              if (!confirm('Confirmer la résiliation définitive de cette commande ? Le slot sera libéré.')) return;
              await fetch('/api/admin/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel_order', orderId }),
              });
              await loadAll();
            };
            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <div className="eyebrow">🔴 Sans engagement</div>
                  <h1>Résiliations <span className="gradient-text">en attente</span></h1>
                  <p>Clients ayant demandé la résiliation. L&apos;accès reste actif jusqu&apos;à la date effective.</p>
                </div>

                <div className="glass-panel admin-card fade-in-up" style={{ marginBottom: 24 }}>
                  <div className="admin-card-head">
                    <div className="icon-bubble">⏳</div>
                    Résiliations programmées ({pending.length})
                  </div>
                  {pending.length === 0 ? (
                    <div className="dash-empty" style={{ borderRadius: 0 }}>
                      <div className="dash-empty-icon">✅</div>
                      <h3>Aucune résiliation en attente</h3>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Client</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Service</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Souscrit le</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Résiliation le</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pending.map(o => (
                            <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '12px', color: 'var(--text-white)', fontWeight: 600 }}>{o.clientEmail}</td>
                              <td style={{ padding: '12px' }}>{o.service.icon} {o.service.name}</td>
                              <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 50, background: 'rgba(239,68,68,0.12)', color: '#f87171', fontWeight: 700, fontSize: '0.8rem' }}>
                                  {o.cancellationEffectiveAt ? new Date(o.cancellationEffectiveAt).toLocaleDateString('fr-FR') : '—'}
                                </span>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <button
                                  onClick={() => confirmCancel(o.id)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', fontSize: '0.78rem' }}
                                >Résilier maintenant</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="glass-panel admin-card fade-in-up">
                  <div className="admin-card-head">
                    <div className="icon-bubble">📁</div>
                    Historique des résiliations ({cancelled.length})
                  </div>
                  {cancelled.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Aucune résiliation définitive enregistrée.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Client</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Service</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Prix</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Résilié le</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cancelled.map(o => (
                            <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: 0.65 }}>
                              <td style={{ padding: '12px' }}>{o.clientEmail}</td>
                              <td style={{ padding: '12px' }}>{o.service.icon} {o.service.name}</td>
                              <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{fmt(o.price)}/mois</td>
                              <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                                {o.cancellationEffectiveAt ? new Date(o.cancellationEffectiveAt).toLocaleDateString('fr-FR') : new Date(o.date).toLocaleDateString('fr-FR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── SUPPORT ── */}
          {activePage === 'support' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <div className="eyebrow">💬 Messagerie</div>
                <h1>Support <span className="gradient-text">Client</span></h1>
                <p>Répondez aux messages de vos clients en temps réel.</p>
              </div>

              <div className="glass-panel fade-in-up" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {supportThreads.length === 0 ? (
                  <div className="dash-empty" style={{ borderRadius: 0 }}>
                    <div className="dash-empty-icon">💬</div>
                    <h3>Aucune conversation</h3>
                    <p>Les messages de vos clients apparaîtront ici dès qu&apos;ils vous écriront depuis leur Espace Client.</p>
                  </div>
                ) : (
                  <div className="chat-layout">
                    {/* Liste des conversations */}
                    <aside className="chat-conv-list">
                      <div className="chat-conv-list-head">
                        <span>📨 Conversations</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{supportThreads.length}</span>
                      </div>
                      {supportThreads.map(thread => {
                        const lastMsg = thread.messages[thread.messages.length - 1];
                        const isActive = thread.orderId === activeSupportThread;
                        const hasUnread = lastMsg && lastMsg.sender !== 'Support StreamMalin';
                        return (
                          <button
                            key={thread.id}
                            onClick={() => setActiveSupportThread(thread.orderId)}
                            className={`chat-conv-item ${isActive ? 'active' : ''}`}
                          >
                            <div className="chat-conv-icon" style={{ background: thread.order.service.gradient }}>
                              {thread.order.service.icon}
                            </div>
                            <div className="chat-conv-body">
                              <div className="chat-conv-row">
                                <span className="chat-conv-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {thread.order.service.name}
                                  {hasUnread && !isActive && (
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', flexShrink: 0 }} />
                                  )}
                                </span>
                                {lastMsg && (
                                  <span className="chat-conv-time">
                                    {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <div className="chat-conv-preview" style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>
                                👤 {thread.order.clientEmail}
                              </div>
                              <div className="chat-conv-preview">
                                {lastMsg ? lastMsg.text : 'Aucun message'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </aside>

                    {/* Chat actif */}
                    <div className="chat-pane">
                      {!activeSupportThread ? (
                        <div className="dash-empty" style={{ borderRadius: 0, padding: '60px 20px' }}>
                          <div className="dash-empty-icon">💬</div>
                          <h3>Sélectionnez une conversation</h3>
                          <p>Choisissez un client dans la liste pour voir ses messages et répondre.</p>
                        </div>
                      ) : (() => {
                        const thread = supportThreads.find(t => t.orderId === activeSupportThread);
                        if (!thread) return null;
                        return (
                          <>
                            <div className="chat-head">
                              <div>
                                <div className="status-online">{thread.order.service.name} — {thread.order.clientEmail}</div>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🔒 Chiffré SSL</span>
                            </div>
                            <div className="chat-messages" style={{ minHeight: 380 }}>
                              {thread.messages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                                  Aucun message pour l&apos;instant.
                                </div>
                              ) : thread.messages.map(msg => {
                                const isSupport = msg.sender !== 'Vous';
                                return (
                                  <div key={msg.id} className={`chat-msg ${isSupport ? 'self' : 'other'}`}>
                                    {!isSupport && <div className="chat-msg-sender">{msg.sender}</div>}
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                    <span className="chat-msg-time">
                                      {new Date(msg.createdAt).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                );
                              })}
                              <div ref={supportBottomRef} />
                            </div>
                            <form onSubmit={sendSupportMessage} className="chat-input-bar">
                              <input
                                type="text"
                                placeholder="Votre réponse au client…"
                                value={supportInput}
                                onChange={e => setSupportInput(e.target.value)}
                                className="dash-input"
                                style={{ flex: 1 }}
                              />
                              <button
                                type="submit"
                                disabled={sendingSupport || !supportInput.trim()}
                                className="btn btn-primary"
                                style={{ opacity: sendingSupport || !supportInput.trim() ? 0.5 : 1 }}
                              >
                                Envoyer
                              </button>
                            </form>
                          </>
                        );
                      })()}
                    </div>
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
                <div className="info-box" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
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
                      <span className="badge-pill" style={{ background: on ? 'rgba(16,185,129,0.13)' : 'rgba(255,255,255,0.06)', color: on ? 'var(--accent-green)' : 'var(--text-muted)', border: `1px solid ${on ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
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
                  <div className="icon-bubble">🔐</div>
                  Double authentification (2FA)
                </div>
                <p className="admin-card-sub">
                  Protège l&apos;accès admin avec un code à usage unique généré par votre téléphone.
                </p>
                {twoFaEnabled ? (
                  <>
                    <div className="info-box" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                      <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>✅ 2FA activée</div>
                      <div className="info-box-text">Un code à 6 chiffres est demandé à chaque connexion administrateur.</div>
                    </div>
                    <div className="form-field" style={{ marginTop: 14 }}>
                      <label className="form-label">Pour désactiver, saisissez un code de votre application</label>
                      <input type="text" inputMode="numeric" placeholder="123456" value={twoFaCode}
                        onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="dash-input" style={{ maxWidth: 200 }} />
                    </div>
                    <button onClick={disable2fa} disabled={twoFaBusy || twoFaCode.length !== 6} className="btn btn-danger btn-sm">
                      {twoFaBusy ? '…' : 'Désactiver la 2FA'}
                    </button>
                  </>
                ) : twoFaSetup ? (
                  <>
                    <div className="info-box">
                      <div className="info-box-title">📱 Étape 1 — Ajoutez le compte</div>
                      <div className="info-box-text">
                        Dans Google Authenticator (ou Authy, Microsoft Authenticator…), choisissez
                        « Saisir une clé de configuration » et entrez la clé ci-dessous.
                      </div>
                    </div>
                    <div style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '1rem', fontWeight: 800, letterSpacing: '0.1em', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px', margin: '12px 0', wordBreak: 'break-all', textAlign: 'center', color: 'var(--text-white)' }}>
                      {twoFaSetup.secret}
                    </div>
                    <div className="form-field">
                      <label className="form-label">Étape 2 — Saisissez le code à 6 chiffres affiché par l&apos;application</label>
                      <input type="text" inputMode="numeric" placeholder="123456" value={twoFaCode}
                        onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="dash-input" style={{ maxWidth: 200 }} autoFocus />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={confirm2fa} disabled={twoFaBusy || twoFaCode.length !== 6} className="btn btn-primary btn-sm">
                        {twoFaBusy ? '…' : 'Confirmer et activer'}
                      </button>
                      <button onClick={() => { setTwoFaSetup(null); setTwoFaCode(''); }} className="btn btn-ghost btn-sm">
                        Annuler
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={start2faSetup} disabled={twoFaBusy} className="btn btn-primary btn-sm">
                    {twoFaBusy ? '…' : '🔐 Activer la double authentification'}
                  </button>
                )}
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
        {/* Modal global – accessible depuis tous les onglets */}
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

        {editOrder && (
          <div className="modal-overlay" onClick={() => setEditOrder(null)}>
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
              <div className="admin-card-head">
                <div className="icon-bubble">✏️</div>
                Modifier les infos client
              </div>
              <form onSubmit={saveOrder}>
                <div className="info-box" style={{ marginBottom: 14 }}>
                  <div className="info-box-title">📝 Corriger les coordonnées</div>
                  <div className="info-box-text">
                    Si le client s&apos;est trompé d&apos;email ou d&apos;adresse YouTube, corrigez-les ici. Les futures notifications utiliseront les nouvelles valeurs.
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Adresse e-mail du client</label>
                  <input
                    type="email"
                    required
                    value={editOrder.clientEmail}
                    onChange={e => setEditOrder(o => o ? { ...o, clientEmail: e.target.value } : o)}
                    className="dash-input"
                    placeholder="client@example.com"
                  />
                </div>
                {editOrder.serviceId === 'youtube' && (
                  <div className="form-field">
                    <label className="form-label">▶️ Adresse e-mail YouTube (Google)</label>
                    <input
                      type="email"
                      value={editOrder.youtubeEmail || ''}
                      onChange={e => setEditOrder(o => o ? { ...o, youtubeEmail: e.target.value } : o)}
                      className="dash-input"
                      placeholder="compte.google@gmail.com"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      Adresse vers laquelle envoyer l&apos;invitation famille YouTube Premium.
                    </p>
                  </div>
                )}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.5)', padding: '10px 12px', borderRadius: 8, marginBottom: 14 }}>
                  Commande : <code style={{ color: 'var(--text-gray)' }}>{editOrder.id.slice(0, 8)}</code> · Service : <strong style={{ color: 'var(--text-gray)' }}>{editOrder.service.name}</strong>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>💾 Sauvegarder</button>
                  <button type="button" onClick={() => setEditOrder(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {catalogOpen && (() => {
          const q = catalogSearch.trim().toLowerCase();
          const filtered = SERVICE_CATALOG.filter(p =>
            (catalogCat === 'all' || p.category === catalogCat) &&
            (!q || p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q))
          );
          return (
            <div className="modal-overlay" onClick={() => setCatalogOpen(false)}>
              <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 920, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                <div className="admin-card-head">
                  <div className="icon-bubble">📚</div>
                  Catalogue de services
                  <button type="button" onClick={() => setCatalogOpen(false)} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>✕</button>
                </div>

                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="dash-input"
                  placeholder="🔍 Rechercher un service (Netflix, Spotify, VPN…)"
                  style={{ marginBottom: 12 }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => setCatalogCat('all')}
                    className={`btn btn-sm ${catalogCat === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  >Tous</button>
                  {CATALOG_CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCatalogCat(c.id)}
                      className={`btn btn-sm ${catalogCat === c.id ? 'btn-primary' : 'btn-ghost'}`}
                    >{c.icon} {c.label}</button>
                  ))}
                </div>

                <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, paddingRight: 4 }}>
                  {filtered.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: 20 }}>Aucun service ne correspond à la recherche.</p>
                  )}
                  {filtered.map(p => {
                    const count = services.filter(s => s.id === p.id || s.id.startsWith(p.id + '-')).length;
                    return (
                      <div key={p.id} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', background: p.gradient, flexShrink: 0 }}>{p.icon}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fmt(p.price)}/mois · {p.maxSlots} place{p.maxSlots > 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-gray)', lineHeight: 1.4, minHeight: 32 }}>{p.tagline}</div>
                        {count > 0 && (
                          <div className="badge-pill success" style={{ alignSelf: 'flex-start' }}>✓ {count} fiche{count > 1 ? 's' : ''} au catalogue</div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => publishPreset(p)}
                            disabled={catalogBusy === p.id}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                          >{catalogBusy === p.id ? '…' : (count > 0 ? '⚡ Ajouter une autre fiche' : '⚡ Ajouter')}</button>
                          <button
                            type="button"
                            onClick={() => fillFromPreset(p)}
                            className="btn btn-ghost btn-sm"
                            title="Pré-remplir le formulaire pour ajuster les tarifs"
                          >✏️</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  ⚡ <strong>Ajouter</strong> publie le service immédiatement · ✏️ pré-remplit le formulaire pour ajuster les tarifs avant publication.
                </div>
              </div>
            </div>
          );
        })()}
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

  const handleSaveAll = async () => {
    setAdding(true);
    if (addPrice && addSlots && addDetails) {
      const ok = await onAddStock(svc.id, addPrice, addSlots, addDetails);
      if (ok) { setAddPrice(''); setAddSlots(''); setAddDetails(''); }
    }
    onSave(local);
    setAdding(false);
  };

  return (
    <div className="glass-panel svc-edit-card">
      <h4>
        <span style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', background: svc.gradient, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
          {svc.icon}
        </span>
        {svc.name}
        <span className="badge-pill" style={{ marginLeft: 'auto', background: local.active ? 'rgba(16,185,129,0.13)' : 'rgba(255,255,255,0.06)', color: local.active ? 'var(--accent-green)' : 'var(--text-muted)', border: `1px solid ${local.active ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
          {local.active ? '● Actif' : '○ Inactif'}
        </span>
      </h4>

      <div className="form-field" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: '10px 12px' }}>
        <label className="form-label" style={{ marginBottom: 6 }}>🎯 Normaliser selon le catalogue</label>
        <select
          value=""
          onChange={e => {
            const preset = SERVICE_CATALOG.find(p => p.id === e.target.value);
            if (!preset) return;
            setLocal(l => ({ ...l, name: preset.name, tagline: preset.tagline, icon: preset.icon, gradient: preset.gradient, features: [...preset.features] }));
          }}
          className="dash-input"
        >
          <option value="">— Choisir un modèle de référence —</option>
          {CATALOG_CATEGORIES.map(cat => (
            <optgroup key={cat.id} label={`${cat.icon} ${cat.label}`}>
              {SERVICE_CATALOG.filter(p => p.category === cat.id).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
          Aligne le nom, l&apos;accroche, l&apos;icône et les caractéristiques sur le modèle officiel — pour que tous les services similaires soient écrits exactement pareil. Le prix et les places restent inchangés. Cliquez ensuite sur « Sauvegarder ».
        </div>
      </div>

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

        <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px dashed rgba(168,85,247,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-soft)', marginBottom: 8 }}>
            ➕ Ajouter un compte de stock
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="number" step="0.01" placeholder="Prix (€)" value={addPrice}
              onChange={e => setAddPrice(e.target.value)} className="dash-input"
              style={{ fontSize: '0.78rem', padding: '7px 9px' }} />
            <input type="number" min="1" placeholder="Places max" value={addSlots}
              onChange={e => setAddSlots(e.target.value)} className="dash-input"
              style={{ fontSize: '0.78rem', padding: '7px 9px' }} />
          </div>
          <textarea rows={2} placeholder="Identifiants : email@example.com / motdepasse" value={addDetails}
            onChange={e => setAddDetails(e.target.value)} className="dash-input"
            style={{ resize: 'vertical', minHeight: 50, fontSize: '0.78rem', padding: '7px 9px', fontFamily: "'SF Mono',Menlo,monospace" }} />
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
            Remplissez ces 3 champs pour ajouter un compte lors du clic sur « Sauvegarder ».
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 8 }}>
        <button
          onClick={handleSaveAll}
          disabled={adding}
          className="btn btn-primary btn-sm"
          style={{ padding: '10px 12px', fontSize: '0.82rem', width: '100%', minWidth: 0 }}
        >
          {adding ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
        </button>
        <button
          onClick={() => onDelete(svc.id, svc.name)}
          className="btn btn-danger btn-sm"
          style={{ padding: '10px 12px', fontSize: '0.82rem', width: '100%', minWidth: 0 }}
        >
          🗑 Supprimer
        </button>
      </div>
    </div>
  );
}
