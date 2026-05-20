'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  LogOut,
  TrendingUp,
  DollarSign,
  Briefcase,
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Send,
  Eye,
  Settings
} from 'lucide-react';

interface StockAccount {
  id: string;
  accountsBoughtPrice: number;
  price: number;
  maxSlots: number;
  filledSlots: number;
  details: string;
  createdAt: string;
}

interface Service {
  id: string;
  name: string;
  tagline: string;
  price: number;
  original: number;
  maxSlots: number;
  active: boolean;
  icon: string;
  gradient: string;
  features: string[];
  stocks: StockAccount[];
}

interface Order {
  id: string;
  date: string;
  serviceId: string;
  price: number;
  total: number;
  details: string;
  clientEmail: string;
  status: string;
  service: {
    name: string;
  };
}

interface Message {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}

interface ChatThread {
  id: string;
  orderId: string;
  title: string;
  createdAt: string;
  messages: Message[];
  order: {
    clientEmail: string;
    service: {
      name: string;
    };
  };
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [submittingLogin, setSubmittingLogin] = useState<boolean>(false);

  // Dashboard Data
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalCogs: 0,
    totalInvestment: 0,
    netProfit: 0,
    marginPercentage: 0,
  });
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);

  // Active view: 'dashboard', 'stocks', 'support'
  const [activeView, setActiveView] = useState<string>('dashboard');

  // New Service Form
  const [showServiceForm, setShowServiceForm] = useState<boolean>(false);
  const [servId, setServId] = useState('');
  const [servName, setServName] = useState('');
  const [servTagline, setServTagline] = useState('');
  const [servPrice, setServPrice] = useState('');
  const [servOriginal, setServOriginal] = useState('');
  const [servMaxSlots, setServMaxSlots] = useState('');
  const [servIcon, setServIcon] = useState('🎬');
  const [servGradient, setServGradient] = useState('');
  const [servFeatures, setServFeatures] = useState('');

  // New Stock Form
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [stockBoughtPrice, setStockBoughtPrice] = useState('');
  const [stockPrice, setStockPrice] = useState('');
  const [stockMaxSlots, setStockMaxSlots] = useState('');
  const [stockDetails, setStockDetails] = useState('');
  const [editingStockId, setEditingStockId] = useState<string | null>(null);

  // Chat Support Admin states
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [sendingReply, setSendingReply] = useState<boolean>(false);

  const adminChatBottomRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<any>(null);

  // 1. Check if already authenticated on mount
  useEffect(() => {
    checkCurrentAuth();
  }, []);

  // 2. Fetch dashboard data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      fetchChatThreads();
    }
  }, [isAuthenticated]);

  // 3. Poll active chat thread messages if support view is open
  useEffect(() => {
    if (isAuthenticated && activeView === 'support' && activeThreadId) {
      chatPollRef.current = setInterval(() => {
        fetchChatThreads(false); // Refresh silent
      }, 5000);
    }

    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [isAuthenticated, activeView, activeThreadId]);

  // Scroll support chat
  useEffect(() => {
    adminChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadId, chatThreads]);

  const checkCurrentAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth');
      if (res.ok) {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submittingLogin) return;

    setSubmittingLogin(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
      } else {
        setLoginError(data.error || 'Mot de passe invalide.');
      }
    } catch (err) {
      setLoginError('Erreur de connexion serveur.');
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      setIsAuthenticated(false);
      setPassword('');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch('/api/admin/stock');
      const data = await res.json();
      if (data.success) {
        setServices(data.services);
        setOrders(data.orders);
        setKpis(data.kpis);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchChatThreads = async (showLoader = true) => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (data.success) {
        setChatThreads(data.threads);
      }
    } catch (err) {
      console.error('Failed to fetch chat threads:', err);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_service',
          id: servId.trim().toLowerCase(),
          name: servName,
          tagline: servTagline,
          price: parseFloat(servPrice),
          original: parseFloat(servOriginal),
          maxSlots: parseInt(servMaxSlots),
          icon: servIcon,
          gradient: servGradient || 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)',
          features: servFeatures.split(',').map((f) => f.trim()),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowServiceForm(false);
        fetchDashboardData();
        // Reset form
        setServId(''); setServName(''); setServTagline(''); setServPrice(''); setServOriginal(''); setServMaxSlots(''); setServFeatures('');
      }
    } catch (err) {
      console.error('Error creating service:', err);
    }
  };

  const handleAddOrEditStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) return;

    try {
      const isEditing = !!editingStockId;
      const res = await fetch('/api/admin/stock', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'update_stock' : 'add_stock',
          id: editingStockId,
          serviceId: selectedServiceId,
          accountsBoughtPrice: parseFloat(stockBoughtPrice),
          price: parseFloat(stockPrice),
          maxSlots: parseInt(stockMaxSlots),
          filledSlots: 0,
          details: stockDetails,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedServiceId(null);
        setEditingStockId(null);
        setStockBoughtPrice('');
        setStockPrice('');
        setStockMaxSlots('');
        setStockDetails('');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error adding stock account:', err);
    }
  };

  const handleDeleteStock = async (stockId: string) => {
    if (!confirm('Voulez-vous supprimer ce compte de stock ?')) return;

    try {
      const res = await fetch(`/api/admin/stock?id=${stockId}&type=stock`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to delete stock:', err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Attention: Supprimer ce service supprimera TOUS ses stocks liés. Confirmer ?')) return;

    try {
      const res = await fetch(`/api/admin/stock?id=${serviceId}&type=service`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to delete service:', err);
    }
  };

  const handleToggleService = async (serviceId: string, currentActive: boolean) => {
    try {
      await fetch('/api/admin/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_service',
          id: serviceId,
          active: !currentActive,
        }),
      });
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to toggle service:', err);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeThreadId || sendingReply) return;

    setSendingReply(true);
    const tempText = replyText;
    setReplyText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeThreadId,
          text: tempText,
          sender: 'Support StreamMalin',
        }),
      });

      if (res.ok) {
        fetchChatThreads(false);
      } else {
        setReplyText(tempText);
      }
    } catch (err) {
      console.error('Failed to reply:', err);
      setReplyText(tempText);
    } finally {
      setSendingReply(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-[#e5e7eb] flex items-center justify-center font-light">
        Chargement des paramètres de sécurité...
      </div>
    );
  }

  // 1. LOCKED LOCK SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center px-6">
        <div className="max-w-md w-full glass-panel p-8 text-center border-t-4 border-purple-600">
          <Lock className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h2 className="text-2xl font-extrabold text-white mb-2">Espace d&apos;administration</h2>
          <p className="text-xs text-[#9ca3af] mb-6 font-light">
            Saisissez le code administrateur de StreamMalin pour déverrouiller la gestion des stocks.
          </p>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Code d'accès secret"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#141524] border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all text-sm text-center font-mono tracking-widest"
              required
            />
            <button
              type="submit"
              disabled={submittingLogin || !password}
              className="w-full btn btn-primary py-3 rounded-xl font-bold uppercase tracking-wider text-sm disabled:opacity-50"
            >
              {submittingLogin ? 'Déchiffrement...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. MAIN ADMIN DASHBOARD
  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#080913]">
      {/* Header Admin */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#060713]/85 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">
              StreamMalin Admin
            </span>
            <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              SUPER-ADMIN STOCK B2C
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-[#141525] border border-white/5 rounded-xl p-1 text-xs font-semibold">
              {[
                { id: 'dashboard', label: 'Indicateurs' },
                { id: 'stocks', label: 'Stocks & Offres' },
                { id: 'support', label: 'Support Chat' },
              ].map((view) => (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    activeView === view.id ? 'bg-[#a855f7] text-white' : 'text-[#9ca3af] hover:text-white'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
              title="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6">
        {loadingDashboard ? (
          <div className="text-center py-32 text-[#9ca3af] font-light">
            Synchronisation de la base de données PostgreSQL...
          </div>
        ) : (
          <>
            {/* VIEW A: FINANCIAL METRICS & DASHBOARD */}
            {activeView === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                <h3 className="text-xl font-extrabold text-white">Tableau de bord financier B2C</h3>

                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* CA */}
                  <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between h-36 border-l-4 border-purple-500 shadow-md shadow-purple-500/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-wider block mb-1">
                        Chiffre d&apos;affaires brut
                      </span>
                      <span className="text-3xl font-black text-white">{kpis.totalRevenue.toFixed(2)}€</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#10b981] font-semibold mt-4">
                      <TrendingUp className="w-4 h-4" /> Somme brute des commandes
                    </div>
                  </div>

                  {/* COGS */}
                  <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between h-36 border-l-4 border-red-500 shadow-md shadow-red-500/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-wider block mb-1">
                        Coûts d&apos;approvisionnement (COGS)
                      </span>
                      <span className="text-3xl font-black text-white">{kpis.totalCogs.toFixed(2)}€</span>
                    </div>
                    <div className="text-[10px] text-[#9ca3af] font-light mt-4">
                      Coût de sourcing calculé par slot loué
                    </div>
                  </div>

                  {/* Profit */}
                  <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between h-36 border-l-4 border-emerald-500 shadow-md shadow-emerald-500/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-wider block mb-1">
                        Bénéfice net réel
                      </span>
                      <span className="text-3xl font-black text-emerald-400">{kpis.netProfit.toFixed(2)}€</span>
                    </div>
                    <div className="text-[10px] text-[#9ca3af] font-light mt-4">
                      Revenus nets de l&apos;activité
                    </div>
                  </div>

                  {/* Margin % */}
                  <div className="glass-panel p-6 relative overflow-hidden flex flex-col justify-between h-36 border-l-4 border-blue-500 shadow-md shadow-blue-500/5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-wider block mb-1">
                        Taux de Marge moyen
                      </span>
                      <span className="text-3xl font-black text-blue-400">{kpis.marginPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="text-[10px] text-blue-400 font-semibold mt-4">
                      Rentabilité moyenne des stocks B2C
                    </div>
                  </div>
                </div>

                {/* Orders Log Table */}
                <div className="glass-panel p-6">
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#9ca3af] mb-4">
                    Commandes B2C récentes
                  </h4>

                  {orders.length === 0 ? (
                    <div className="text-center py-10 text-xs text-[#9ca3af] font-light">
                      Aucune commande enregistrée pour l&apos;instant.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-light">
                        <thead>
                          <tr className="border-b border-white/5 text-[#9ca3af] font-bold uppercase tracking-wider">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Commande ID</th>
                            <th className="py-3 px-4">Email client</th>
                            <th className="py-3 px-4">Service</th>
                            <th className="py-3 px-4">Prix loué</th>
                            <th className="py-3 px-4">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {orders.map((o) => (
                            <tr key={o.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3.5 px-4 font-mono">{new Date(o.date).toLocaleDateString()}</td>
                              <td className="py-3.5 px-4 font-mono text-purple-400">{o.id}</td>
                              <td className="py-3.5 px-4">{o.clientEmail}</td>
                              <td className="py-3.5 px-4 font-semibold text-white">{o.service?.name}</td>
                              <td className="py-3.5 px-4 font-semibold text-emerald-400">{o.total.toFixed(2)}€</td>
                              <td className="py-3.5 px-4">
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide">
                                  {o.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW B: STOCK & PLATFORM MANAGEMENT */}
            {activeView === 'stocks' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-extrabold text-white">Gestion du Catalogue & Stock</h3>
                  <button
                    onClick={() => setShowServiceForm(!showServiceForm)}
                    className="btn btn-primary btn-sm gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Créer / Modifier Service
                  </button>
                </div>

                {/* Service Form */}
                {showServiceForm && (
                  <form onSubmit={handleCreateService} className="glass-panel p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <h4 className="md:col-span-3 text-xs font-bold uppercase tracking-wider text-purple-400">
                      Édition ou création de Service
                    </h4>
                    <input
                      type="text" placeholder="ID (ex: netflix, disney)" value={servId}
                      onChange={(e) => setServId(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text" placeholder="Nom officiel (ex: Netflix Premium)" value={servName}
                      onChange={(e) => setServName(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text" placeholder="Slogan accrocheur" value={servTagline}
                      onChange={(e) => setServTagline(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="number" step="0.01" placeholder="Prix de revente (€)" value={servPrice}
                      onChange={(e) => setServPrice(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="number" step="0.01" placeholder="Prix public officiel France (€)" value={servOriginal}
                      onChange={(e) => setServOriginal(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="number" placeholder="Nombre maximal de slots (ex: 4)" value={servMaxSlots}
                      onChange={(e) => setServMaxSlots(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text" placeholder="Emoji icône (ex: 🎬, 🎵)" value={servIcon}
                      onChange={(e) => setServIcon(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text" placeholder="Dégradé CSS (laisser vide pour violet/bleu)" value={servGradient}
                      onChange={(e) => setServGradient(e.target.value)}
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text" placeholder="Avantages (séparés par virgules)" value={servFeatures}
                      onChange={(e) => setServFeatures(e.target.value)} required
                      className="px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs"
                    />
                    <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                      <button
                        type="button" onClick={() => setShowServiceForm(false)}
                        className="btn btn-ghost btn-sm"
                      >
                        Annuler
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Enregistrer Service
                      </button>
                    </div>
                  </form>
                )}

                {/* Stock Edit Modal / Form overlay */}
                {selectedServiceId && (
                  <form onSubmit={handleAddOrEditStock} className="glass-panel p-6 space-y-4 border border-purple-500 animate-slideDown">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      {editingStockId ? 'Éditer un compte de stock' : 'Ajouter un compte de stock'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#9ca3af] uppercase">Coût d&apos;achat global (COGS)</label>
                        <input
                          type="number" step="0.01" placeholder="Ex: 10.00" value={stockBoughtPrice}
                          onChange={(e) => setStockBoughtPrice(e.target.value)} required
                          className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#9ca3af] uppercase">Prix mensuel par slot (€)</label>
                        <input
                          type="number" step="0.01" placeholder="Ex: 5.49" value={stockPrice}
                          onChange={(e) => setStockPrice(e.target.value)} required
                          className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#9ca3af] uppercase">Capacité max de slots (écrans)</label>
                        <input
                          type="number" placeholder="Ex: 4" value={stockMaxSlots}
                          onChange={(e) => setStockMaxSlots(e.target.value)} required
                          className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#9ca3af] uppercase">Identifiants cryptés ou Instructions</label>
                      <textarea
                        rows={3} placeholder="Ex: Email: netflix-turquie@mail.com | Pass: 123456 | Profil: Max (Écran 2)"
                        value={stockDetails} onChange={(e) => setStockDetails(e.target.value)} required
                        className="w-full px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-xs font-mono"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedServiceId(null);
                          setEditingStockId(null);
                          setStockBoughtPrice(''); setStockPrice(''); setStockMaxSlots(''); setStockDetails('');
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        Annuler
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm font-bold">
                        Sauvegarder le stock
                      </button>
                    </div>
                  </form>
                )}

                {/* Services Catalog with Stock List */}
                <div className="grid grid-cols-1 gap-6">
                  {services.map((service) => (
                    <div key={service.id} className="glass-panel p-6 space-y-4">
                      {/* Service Top row */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{service.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-white text-base leading-tight">
                                {service.name}
                              </h4>
                              <span className={`text-[8px] font-bold px-2 py-0.5 rounded border ${
                                service.active
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {service.active ? 'Actif' : 'Désactivé'}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#9ca3af] font-light mt-0.5">
                              Prix conseillé : {service.price.toFixed(2)}€/mois | Officiel : {service.original.toFixed(2)}€
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleService(service.id, service.active)}
                            className="btn btn-ghost btn-sm text-[10px] uppercase font-bold"
                          >
                            {service.active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            onClick={() => setSelectedServiceId(service.id)}
                            className="btn btn-primary btn-sm text-[10px] uppercase font-bold gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter Stock
                          </button>
                          <button
                            onClick={() => handleDeleteService(service.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                            title="Supprimer le service"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Stock Accounts details under this service */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider block">
                          Comptes de stock configurés ({service.stocks?.length || 0})
                        </span>

                        {service.stocks?.length === 0 ? (
                          <div className="text-xs font-light text-[#9ca3af] italic py-2">
                            Aucun compte de stock approvisionné pour ce service.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {service.stocks.map((stock) => (
                              <div key={stock.id} className="p-4 rounded-xl bg-black/40 border border-white/5 relative group">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-[9px] font-bold bg-[#141525] border border-white/10 px-2 py-0.5 rounded font-mono text-purple-400">
                                      STOCK ACCOUNT
                                    </span>
                                    <div className="text-xs font-semibold text-white mt-1.5">
                                      Achat : {stock.accountsBoughtPrice.toFixed(2)}€ | Vente : {stock.price.toFixed(2)}€
                                    </div>
                                  </div>

                                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        setSelectedServiceId(service.id);
                                        setEditingStockId(stock.id);
                                        setStockBoughtPrice(stock.accountsBoughtPrice.toString());
                                        setStockPrice(stock.price.toString());
                                        setStockMaxSlots(stock.maxSlots.toString());
                                        setStockDetails(stock.details);
                                      }}
                                      className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-white transition-colors"
                                      title="Éditer"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteStock(stock.id)}
                                      className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                <div className="text-[10px] text-[#9ca3af] space-y-1 mt-3">
                                  <div className="flex justify-between">
                                    <span>Taux de remplissage :</span>
                                    <span className={`font-bold ${stock.filledSlots >= stock.maxSlots ? 'text-red-400' : 'text-emerald-400'}`}>
                                      {stock.filledSlots} / {stock.maxSlots} slots occupés
                                    </span>
                                  </div>
                                  <div className="pt-2 border-t border-white/5">
                                    <span className="font-semibold text-[8px] text-[#6b7280] block mb-1">ACCÈS CLIENTS</span>
                                    <code className="block bg-[#111221] p-1.5 rounded text-[9px] text-blue-400 break-all select-all font-mono">
                                      {stock.details}
                                    </code>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW C: ADMIN LIVE SUPPORT TICKETS */}
            {activeView === 'support' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn h-[680px]">
                {/* Tickets Thread List */}
                <div className="lg:col-span-4 glass-panel p-4 flex flex-col h-full overflow-hidden">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#9ca3af] mb-4 flex items-center gap-2 shrink-0">
                    <MessageCircle className="w-4 h-4 text-purple-400" /> Conversations actives ({chatThreads.length})
                  </h3>

                  <div className="flex-1 overflow-y-auto space-y-2.5">
                    {chatThreads.length === 0 ? (
                      <div className="text-center py-20 text-xs text-[#9ca3af] font-light">
                        Aucun ticket de support client ouvert.
                      </div>
                    ) : (
                      chatThreads.map((thread) => {
                        const lastMsg = thread.messages[thread.messages.length - 1];
                        return (
                          <button
                            key={thread.id}
                            onClick={() => setActiveThreadId(thread.id)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col gap-1.5 ${
                              activeThreadId === thread.id
                                ? 'bg-purple-500/10 border-purple-500 text-white'
                                : 'bg-[#141525]/60 border-white/5 text-[#9ca3af] hover:bg-white/5'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[10px] w-full font-bold">
                              <span className="text-white uppercase">{thread.order.service?.name}</span>
                              <span className="text-purple-400 font-mono">ID: {thread.orderId}</span>
                            </div>
                            <span className="text-xs font-semibold text-white truncate w-full">{thread.order?.clientEmail}</span>
                            {lastMsg && (
                              <p className="text-[10px] text-[#9ca3af] truncate w-full font-light mt-1">
                                <strong className="text-white">{lastMsg.sender} :</strong> {lastMsg.text}
                              </p>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Conversation View */}
                <div className="lg:col-span-8 glass-panel flex flex-col h-full overflow-hidden">
                  {activeThreadId ? (
                    (() => {
                      const thread = chatThreads.find((t) => t.id === activeThreadId);
                      if (!thread) return null;

                      return (
                        <>
                          {/* Chat Header */}
                          <div className="p-4 border-b border-white/5 bg-[#111221]/50 flex items-center justify-between shrink-0">
                            <div>
                              <h4 className="font-bold text-white text-sm">Dialogue avec {thread.order?.clientEmail}</h4>
                              <p className="text-[10px] text-[#9ca3af] font-light mt-0.5">
                                Commande ID: <span className="font-mono text-purple-400 font-bold">{thread.orderId}</span> pour {thread.order.service?.name}
                              </p>
                            </div>
                          </div>

                          {/* Chat history */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {thread.messages.map((msg) => {
                              const isSelf = msg.sender.includes('Support');
                              return (
                                <div
                                  key={msg.id}
                                  className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                      isSelf
                                        ? 'bg-gradient-to-br from-[#a855f7] to-[#3b82f6] text-white rounded-tr-none'
                                        : 'bg-[#181926] border border-white/5 text-[#e5e7eb] rounded-tl-none'
                                    }`}
                                  >
                                    <span className="text-[8px] font-bold text-purple-300 block mb-1">
                                      {msg.sender}
                                    </span>
                                    <p className="whitespace-pre-wrap font-light">{msg.text}</p>
                                    <span className="text-[7px] opacity-60 block text-right mt-1.5">
                                      {new Date(msg.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={adminChatBottomRef} />
                          </div>

                          {/* Message input */}
                          <form
                            onSubmit={handleSendReply}
                            className="p-3 border-t border-white/5 bg-[#111221]/30 flex gap-2 shrink-0"
                          >
                            <input
                              type="text"
                              placeholder="Répondre au client..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="flex-1 px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all text-xs"
                            />
                            <button
                              type="submit"
                              disabled={sendingReply || !replyText.trim()}
                              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#3b82f6] text-white font-bold flex items-center justify-center disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center p-20 text-center text-[#9ca3af] font-light">
                      <MessageCircle className="w-12 h-12 text-[#1c1d30] mb-4" />
                      Sélectionnez une discussion à gauche pour répondre à un client en temps réel.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
