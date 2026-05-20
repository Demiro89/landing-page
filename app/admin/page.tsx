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
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activePage, setActivePage] = useState<AdminPage>('dashboard');

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ totalRevenue: 0, totalCogs: 0, totalInvestment: 0, netProfit: 0, marginPercentage: 0 });
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<Settings>({
    crypto_btc: '', crypto_eth: '', crypto_usdt: '', crypto_ltc: '',
    gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'true',
  });
  const [loading, setLoading] = useState(false);

  // Stock form
  const [stockForm, setStockForm] = useState({ serviceId: '', accountsBoughtPrice: '', price: '', maxSlots: '', details: '' });
  // Edit stock modal
  const [editStock, setEditStock] = useState<StockAccount | null>(null);
  // Service form (create)
  const [srvForm, setSrvForm] = useState({ id: '', name: '', icon: '', gradient: '', price: '', original: '', tagline: '', maxSlots: '', features: '' });

  /* ─── Auth ──────────────────────────────────────────────────────────────── */
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

  /* ─── Data loading ───────────────────────────────────────────────────────── */
  const loadAll = async () => {
    setLoading(true);
    try {
      const [stockRes, clientRes, settRes] = await Promise.all([
        fetch('/api/admin/stock').then(r => r.json()),
        fetch('/api/admin/clients').then(r => r.json()),
        fetch('/api/admin/settings').then(r => r.json()),
      ]);
      if (stockRes.success) { setServices(stockRes.services); setOrders(stockRes.orders); setKpis(stockRes.kpis); }
      if (clientRes.success) setClients(clientRes.clients);
      if (settRes.success) setSettings(settRes.settings);
    } finally { setLoading(false); }
  };

  /* ─── Chart (7 derniers jours) ──────────────────────────────────────────── */
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

  /* ─── Actions stock ─────────────────────────────────────────────────────── */
  const addStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_stock', serviceId: stockForm.serviceId, accountsBoughtPrice: stockForm.accountsBoughtPrice, price: stockForm.price, maxSlots: stockForm.maxSlots, filledSlots: 0, details: stockForm.details }),
    });
    const d = await r.json();
    if (d.success) { toast('Compte de stock ajouté avec succès !'); setStockForm({ serviceId: '', accountsBoughtPrice: '', price: '', maxSlots: '', details: '' }); loadAll(); }
    else toast('Erreur : ' + d.error);
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

  /* ─── Actions services ──────────────────────────────────────────────────── */
  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = srvForm.features.split(',').map(f => f.trim()).filter(Boolean);
    const r = await fetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_service', id: srvForm.id, name: srvForm.name, icon: srvForm.icon, gradient: srvForm.gradient, price: srvForm.price, original: srvForm.original, tagline: srvForm.tagline, maxSlots: srvForm.maxSlots, features }),
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

  /* ─── Actions settings ──────────────────────────────────────────────────── */
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

  /* ─── LOGIN SCREEN ───────────────────────────────────────────────────────── */
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center p-6">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <div className="glass-panel rounded-3xl p-10 w-full max-w-md relative z-10 text-center">
          <a href="/" className="flex items-center justify-center gap-2 font-extrabold text-xl mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black" style={{ background: 'var(--gradient-primary)' }}>SM</div>
            <span className="gradient-text">StreamMalin</span>
          </a>
          <h2 className="text-2xl font-extrabold text-white mb-2">Panel Administrateur</h2>
          <p className="text-[#9ca3af] text-sm font-light mb-8">Connectez-vous pour superviser la plateforme</p>

          <form onSubmit={doLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs text-[#9ca3af] font-semibold mb-2">Mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#141524] border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
            <button type="submit" className="w-full btn btn-primary py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 mt-2">
              🔐 Connexion Sécurisée
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ─── ADMIN DASHBOARD ────────────────────────────────────────────────────── */
  const allStocks = services.flatMap(s => s.stocks.map(st => ({ ...st, serviceName: s.name, serviceIcon: s.icon, serviceGradient: s.gradient })));

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#e5e7eb] flex flex-col">
      {/* Toast */}
      <div id="sm-toast" style={{ display: 'none', position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}
        className="bg-[#141524] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-xl">
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0b0c10]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-extrabold text-lg">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ background: 'var(--gradient-primary)' }}>SM</div>
            <span className="gradient-text">StreamMalin</span>
          </a>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#9ca3af]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Mode Super-Administrateur
            </div>
            <button onClick={doLogout} className="text-sm text-red-400 border border-red-400/30 px-4 py-1.5 rounded-lg hover:bg-red-400/10 transition-all">
              Déconnexion ↩
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="w-60 border-r border-white/5 py-6 px-3 shrink-0 hidden md:block">
          {([
            ['dashboard', '📊', 'Tableau de bord'],
            ['stocks', '📦', 'Gestion des Stocks'],
            ['services', '🎬', 'Gestion des Services'],
            ['clients', '👥', 'Utilisateurs & Clients'],
            ['settings', '⚙️', 'Paramètres globaux'],
          ] as [AdminPage, string, string][]).map(([page, icon, label]) => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold mb-1 transition-all ${
                activePage === page ? 'text-white' : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
              }`}
              style={activePage === page ? { background: 'var(--gradient-primary)' } : {}}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
          <div className="border-t border-white/5 my-3" />
          <a href="/" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-cyan-400 hover:bg-white/5 transition-all">
            <span>🏠</span> Retour au site public
          </a>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">

          {/* ── TAB 1: DASHBOARD ── */}
          {activePage === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">📊 Vue d&apos;ensemble de la plateforme</h2>

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Chiffre d\'Affaires Brut (CA)', value: fmt(kpis.totalRevenue), color: 'text-cyan-400', sub: '↑ Total des abonnements loués' },
                  { label: 'Coût de Revient (COGS)', value: fmt(kpis.totalInvestment), color: 'text-red-400', sub: '↓ Achat des comptes à l\'étranger' },
                  { label: 'Bénéfice Net Réel', value: fmt(kpis.netProfit), color: 'text-blue-400', sub: '↑ Marge nette cumulée (€)' },
                  { label: 'Taux de Marge (%)', value: kpis.marginPercentage.toFixed(1).replace('.', ',') + '%', color: 'text-yellow-400', sub: '📊 Rentabilité globale de l\'activité' },
                ].map((card, i) => (
                  <div key={i} className="glass-panel rounded-2xl p-5 hover:scale-[1.02] transition-transform">
                    <div className="text-xs text-[#9ca3af] font-semibold mb-2">{card.label}</div>
                    <div className={`text-2xl font-black ${card.color} mb-1`}>{card.value}</div>
                    <div className="text-[10px] text-[#6b7280]">{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="glass-panel rounded-2xl p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white">📈 Bénéfices nets journaliers (7 derniers jours)</h3>
                  <span className="text-xs text-[#6b7280]">Actualisé en direct</span>
                </div>
                <div className="flex items-end justify-around gap-2 h-40">
                  {chartData.map((day, i) => {
                    const h = Math.max((day.profit / maxProfit) * 100, day.profit > 0 ? 5 : 2);
                    return (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1">
                        <div className="text-[10px] text-[#9ca3af]">{day.profit > 0 ? fmt(day.profit) : '—'}</div>
                        <div className="w-full rounded-lg min-h-[4px] transition-all" style={{ height: `${h}%`, background: 'var(--gradient-primary)', opacity: 0.85 }} />
                        <div className="text-[10px] text-[#6b7280]">{day.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent orders */}
              <div className="glass-panel rounded-2xl p-6 overflow-auto">
                <h3 className="font-bold text-white mb-4">🕐 Historique récent des commandes clients</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6b7280] border-b border-white/5">
                      {['ID Commande', 'Date', 'Service', 'Hôte', 'Net', 'Frais', 'Total Payé', 'Statut'].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-[#9ca3af]">Aucune transaction sur la plateforme pour le moment.</td></tr>
                    ) : orders.slice(0, 20).map(o => (
                      <tr key={o.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{o.id.slice(0, 8)}</td>
                        <td className="py-2.5 px-3 text-[#9ca3af]">{new Date(o.date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-2.5 px-3">{o.service.icon} {o.service.name}</td>
                        <td className="py-2.5 px-3 text-[#9ca3af]">StreamMalin (B2C)</td>
                        <td className="py-2.5 px-3">{fmt(o.price)}</td>
                        <td className="py-2.5 px-3 text-cyan-400 font-semibold">Gratuit</td>
                        <td className="py-2.5 px-3 text-cyan-400 font-black">{fmt(o.total)}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--accent-green)' }}>
                            {o.status === 'active' ? 'Complété' : o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 2: STOCKS ── */}
          {activePage === 'stocks' && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">📦 Gestion des Stocks (B2C)</h2>

              {/* Add stock form */}
              <div className="glass-panel rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-white mb-5">➕ Ajouter un compte de stock (Achat à l&apos;étranger)</h3>
                <form onSubmit={addStock}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">Sélectionner le Service</label>
                      <select
                        required
                        value={stockForm.serviceId}
                        onChange={e => setStockForm(f => ({ ...f, serviceId: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white focus:outline-none focus:border-purple-500 text-sm"
                      >
                        <option value="">— Choisir un service —</option>
                        {services.filter(s => s.active).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">Coût d&apos;achat à l&apos;étranger (COGS €)</label>
                      <input type="number" step="0.01" required placeholder="Ex: 2.00" value={stockForm.accountsBoughtPrice}
                        onChange={e => setStockForm(f => ({ ...f, accountsBoughtPrice: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">Prix de location mensuel (€)</label>
                      <input type="number" step="0.01" required placeholder="Ex: 3.49" value={stockForm.price}
                        onChange={e => setStockForm(f => ({ ...f, price: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">Places disponibles (Max Slots)</label>
                      <input type="number" required placeholder="Ex: 5" min="1" value={stockForm.maxSlots}
                        onChange={e => setStockForm(f => ({ ...f, maxSlots: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">Accès sécurisés (Lien d&apos;invitation ou identifiants)</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Ex: email@example.com / motdepasse (Profil 3) OU Lien famille Google"
                      value={stockForm.details}
                      onChange={e => setStockForm(f => ({ ...f, details: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary rounded-xl px-6 py-2.5 text-sm font-bold">⚡ Enregistrer ce compte en stock</button>
                </form>
              </div>

              {/* Stock list */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-bold text-white mb-2">📋 Comptes de stock actuellement disponibles</h3>
                <p className="text-xs text-[#9ca3af] font-light mb-5">Supervisez et gérez les comptes familiaux achetés à l&apos;étranger pour la location directe.</p>
                {allStocks.length === 0 ? (
                  <div className="text-center py-12 text-[#9ca3af] font-light">Aucun compte de stock actif actuellement.</div>
                ) : (
                  <div className="space-y-4">
                    {allStocks.map(st => (
                      <div key={st.id} className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/2">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: (st as any).serviceGradient }}>
                          {(st as any).serviceIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-white text-sm">{(st as any).serviceName} <span className="text-[#6b7280] font-normal text-[10px]">(ID: {st.id.slice(0, 8)})</span></h5>
                          <p className="text-xs text-[#9ca3af]">
                            Prix Location : <strong className="text-white">{fmt(st.price)}/mois</strong> · Sourcing (COGS) : <strong className="text-red-400">{fmt(st.accountsBoughtPrice)}</strong>
                          </p>
                          <p className="text-xs text-[#9ca3af]">Remplissage : <strong className="text-white">{st.filledSlots} / {st.maxSlots} places occupées</strong></p>
                          <p className="text-[10px] text-[#6b7280] mt-1 truncate">🔑 {st.details}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button onClick={() => setEditStock(st)} className="btn btn-primary btn-sm rounded-lg text-xs px-3 py-1.5">📝 Modifier</button>
                          <button onClick={() => deleteStock(st.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-all">❌ Retirer</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit modal */}
              {editStock && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                  <div className="glass-panel rounded-2xl p-8 w-full max-w-lg">
                    <h3 className="font-bold text-white text-lg mb-2">📝 Modifier le compte en stock</h3>
                    <p className="text-xs text-[#9ca3af] mb-5">Mettez à jour les tarifs, la capacité ou les accès sécurisés.</p>
                    <form onSubmit={saveStock} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-[#9ca3af] mb-1">Coût de revient / COGS (€)</label>
                          <input type="number" step="0.01" required value={editStock.accountsBoughtPrice}
                            onChange={e => setEditStock(s => s ? { ...s, accountsBoughtPrice: +e.target.value } : s)}
                            className="w-full px-3 py-2 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-[#9ca3af] mb-1">Prix de location mensuel (€)</label>
                          <input type="number" step="0.01" required value={editStock.price}
                            onChange={e => setEditStock(s => s ? { ...s, price: +e.target.value } : s)}
                            className="w-full px-3 py-2 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-[#9ca3af] mb-1">Places occupées (filled slots)</label>
                          <input type="number" required min="0" value={editStock.filledSlots}
                            onChange={e => setEditStock(s => s ? { ...s, filledSlots: +e.target.value } : s)}
                            className="w-full px-3 py-2 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-[#9ca3af] mb-1">Places maximales (max slots)</label>
                          <input type="number" required min="1" value={editStock.maxSlots}
                            onChange={e => setEditStock(s => s ? { ...s, maxSlots: +e.target.value } : s)}
                            className="w-full px-3 py-2 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-[#9ca3af] mb-1">Identifiants / Liens sécurisés</label>
                        <textarea rows={3} required value={editStock.details}
                          onChange={e => setEditStock(s => s ? { ...s, details: e.target.value } : s)}
                          className="w-full px-3 py-2 rounded-xl bg-[#141524] border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-purple-500" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button type="submit" className="flex-1 btn btn-primary rounded-xl py-2.5 text-sm font-bold">💾 Sauvegarder</button>
                        <button type="button" onClick={() => setEditStock(null)} className="flex-1 btn btn-outline rounded-xl py-2.5 text-sm text-[#9ca3af]">Annuler</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: SERVICES ── */}
          {activePage === 'services' && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">🎬 Configuration des Services &amp; Tarifs</h2>

              {/* Create service form */}
              <div className="glass-panel rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-white mb-5">➕ Créer un Nouveau Service au Catalogue</h3>
                <form onSubmit={createService}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {[
                      { label: 'Identifiant unique (minuscules)', key: 'id', placeholder: 'Ex: netflix' },
                      { label: 'Nom du Service', key: 'name', placeholder: 'Ex: Netflix Premium' },
                      { label: 'Icône / Emoji', key: 'icon', placeholder: 'Ex: 🍿' },
                      { label: 'Dégradé CSS', key: 'gradient', placeholder: 'Ex: linear-gradient(135deg, #E50914, #B81D24)' },
                      { label: 'Prix de location conseillé (€)', key: 'price', placeholder: 'Ex: 4.99', type: 'number' },
                      { label: 'Tarif Public Officiel France (€)', key: 'original', placeholder: 'Ex: 19.99', type: 'number' },
                      { label: 'Phrase d\'accroche marketing', key: 'tagline', placeholder: 'Ex: Séries et films en Ultra HD' },
                      { label: 'Places maximales', key: 'maxSlots', placeholder: 'Ex: 4', type: 'number' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">{f.label}</label>
                        <input
                          type={f.type || 'text'}
                          step={f.type === 'number' ? '0.01' : undefined}
                          required
                          placeholder={f.placeholder}
                          value={(srvForm as any)[f.key]}
                          onChange={e => setSrvForm(form => ({ ...form, [f.key]: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">Fonctionnalités clés (séparées par des virgules)</label>
                    <input
                      type="text" required
                      placeholder="Ex: Ultra HD 4K, Profil dédié et privé, Téléchargement hors-ligne"
                      value={srvForm.features}
                      onChange={e => setSrvForm(f => ({ ...f, features: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary rounded-xl px-6 py-2.5 text-sm font-bold">🎬 Publier le nouveau service</button>
                </form>
              </div>

              {/* Services list */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-bold text-white mb-2">Catalogue actuel des services</h3>
                <p className="text-xs text-[#9ca3af] font-light mb-5">Ajustez les prix, descriptions et le statut d&apos;activation des offres de streaming.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.map(svc => (
                    <ServiceEditCard key={svc.id} svc={svc} onSave={saveService} onToggle={toggleService} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: CLIENTS ── */}
          {activePage === 'clients' && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">👥 Comptes Utilisateurs &amp; Clients</h2>
              <div className="glass-panel rounded-2xl p-6 overflow-auto">
                <h3 className="font-bold text-white mb-4">Base de données des clients enregistrés</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6b7280] border-b border-white/5">
                      {['Avatar', 'Adresse Email', 'Date 1ère commande', 'Commandes', 'Actifs', 'Total Dépensé'].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-[#9ca3af]">Aucun client enregistré pour le moment.</td></tr>
                    ) : clients.map((c, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--gradient-primary)' }}>
                            {c.email[0].toUpperCase()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">{c.email}</td>
                        <td className="py-2.5 px-3 text-[#9ca3af]">{c.firstOrderDate}</td>
                        <td className="py-2.5 px-3 text-center"><span className="px-2 py-0.5 rounded-full bg-white/5 text-white font-bold">{c.orderCount}</span></td>
                        <td className="py-2.5 px-3 text-center"><span className="px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--accent-green)' }}>{c.activeOrders}</span></td>
                        <td className="py-2.5 px-3 text-cyan-400 font-black">{fmt(c.totalSpent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 5: SETTINGS ── */}
          {activePage === 'settings' && (
            <div>
              <h2 className="text-2xl font-black text-white mb-6">⚙️ Paramètres système globaux</h2>

              {/* Mode facturation */}
              <div className="glass-panel rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-white mb-3">💰 Mode de Facturation B2C</h3>
                <p className="text-xs text-[#9ca3af] font-light mb-3">La plateforme fonctionne en vente directe d&apos;accès premium. Tous les prix affichés aux clients sont nets et sans commissions supplémentaires.</p>
                <div className="p-3 rounded-lg border border-dashed border-cyan-400/30 bg-cyan-400/5 text-cyan-400 text-xs font-bold">
                  🛡️ Frais de plateforme / Commissions : 0,00€ (Prix plat garanti pour tous les utilisateurs).
                </div>
              </div>

              {/* Gateways */}
              <div className="glass-panel rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-white mb-4">💳 Moyens de paiement actifs</h3>
                {[
                  { key: 'gateway_cb', label: 'Carte Bancaire (Stripe)' },
                  { key: 'gateway_paypal', label: 'PayPal Checkout (Biens & Services)' },
                  { key: 'gateway_crypto', label: 'Cryptomonnaies (Blockchain)' },
                ].map(g => (
                  <div key={g.key} className="flex items-center gap-4 mb-4">
                    <button
                      onClick={() => setSettings(s => ({ ...s, [g.key]: s[g.key] === 'true' ? 'false' : 'true' }))}
                      className={`w-12 h-6 rounded-full relative transition-all shrink-0 ${settings[g.key] !== 'false' ? 'bg-gradient-to-r from-purple-500 to-cyan-500' : 'bg-[#2a2a3a]'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings[g.key] !== 'false' ? 'left-6' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm font-semibold text-white">{g.label}</span>
                  </div>
                ))}
              </div>

              {/* Crypto addresses */}
              <div className="glass-panel rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-white mb-4">₿ Configuration des portefeuilles cryptos de réception</h3>
                {[
                  { key: 'crypto_btc', label: 'Bitcoin (BTC)' },
                  { key: 'crypto_eth', label: 'Ethereum (ETH)' },
                  { key: 'crypto_usdt', label: 'USDT (Tether TRC20)' },
                  { key: 'crypto_ltc', label: 'Litecoin (LTC)' },
                ].map(c => (
                  <div key={c.key} className="mb-4">
                    <label className="block text-xs text-[#9ca3af] font-semibold mb-1.5">{c.label}</label>
                    <input
                      type="text"
                      placeholder={`Adresse ${c.label}...`}
                      value={settings[c.key] || ''}
                      onChange={e => setSettings(s => ({ ...s, [c.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                ))}
              </div>

              <button onClick={saveSettings} className="btn btn-primary rounded-xl px-8 py-3 text-sm font-bold">
                💾 Mettre à jour les paramètres
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

/* ─── ServiceEditCard (inline editable) ─────────────────────────────────── */
function ServiceEditCard({ svc, onSave, onToggle }: {
  svc: Service;
  onSave: (svc: Service) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [local, setLocal] = useState(svc);
  useEffect(() => { setLocal(svc); }, [svc]);

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5">
      <h4 className="font-bold text-white mb-4">{svc.icon} {svc.name}</h4>
      <div className="space-y-3">
        {[
          { label: 'Nom affiché', key: 'name' },
          { label: 'Phrase d\'accroche', key: 'tagline' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] text-[#9ca3af] mb-1">{f.label}</label>
            <input type="text" value={(local as any)[f.key]} onChange={e => setLocal(l => ({ ...l, [f.key]: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg bg-[#141524] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Prix conseillé (€)', key: 'price' },
            { label: 'Prix public France (€)', key: 'original' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[10px] text-[#9ca3af] mb-1">{f.label}</label>
              <input type="number" step="0.01" value={(local as any)[f.key]} onChange={e => setLocal(l => ({ ...l, [f.key]: +e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg bg-[#141524] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-[10px] text-[#9ca3af] mb-1">Places maximales</label>
          <input type="number" value={local.maxSlots} onChange={e => setLocal(l => ({ ...l, maxSlots: +e.target.value }))}
            className="w-full px-3 py-1.5 rounded-lg bg-[#141524] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLocal(l => ({ ...l, active: !l.active })); onToggle(svc.id, !local.active); }}
            className={`w-10 h-5 rounded-full relative transition-all shrink-0 ${local.active ? 'bg-gradient-to-r from-purple-500 to-cyan-500' : 'bg-[#2a2a3a]'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${local.active ? 'left-5' : 'left-0.5'}`} />
          </button>
          <span className="text-xs text-[#9ca3af] font-semibold">Service actif au catalogue</span>
        </div>
      </div>
      <button onClick={() => onSave(local)} className="w-full mt-4 btn btn-primary rounded-lg py-2 text-xs font-bold">
        💾 Sauvegarder ce service
      </button>
    </div>
  );
}
