'use client';

import React, { useState, useEffect, useRef } from 'react';
import Footer from '@/components/Footer';

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
  availableSlots: number;
  availableStockId: string | null;
}

interface Stock {
  id: string;
  serviceId: string;
  price: number;
  maxSlots: number;
  filledSlots: number;
  service: {
    name: string;
    icon: string;
    gradient: string;
    tagline: string;
    original: number;
  };
}

interface Message {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
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
  cancellationEffectiveAt?: string | null;
  stripeSubscriptionId?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  nextBillingAt?: string | null;
  service: { name: string; icon: string; gradient: string };
  chats?: { id: string; orderId: string; messages: Message[] };
}

type View = 'storefront' | 'dashboard';
type DashTab = 'orders' | 'rent' | 'chat' | 'settings';
type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
type FilterType = 'all' | 'streaming' | 'musique' | 'securite';

const SERVICE_FILTERS: Record<FilterType, string[]> = {
  all: [],
  streaming: ['netflix', 'youtube', 'disney'],
  musique: ['spotify'],
  securite: ['surfshark'],
};

export default function Home() {
  const [view, setView] = useState<View>('storefront');
  const [dashTab, setDashTab] = useState<DashTab>('orders');
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Calculator
  const [calcSel, setCalcSel] = useState<Record<string, boolean>>({
    netflix: false, youtube: true, spotify: false, disney: true, surfshark: true,
  });

  // Espace client (auth)
  const [authChecked, setAuthChecked] = useState(false);
  const [customer, setCustomer] = useState<{ id: string; email: string; emailVerified: boolean } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const [searchedEmail, setSearchedEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [, setOrdersError] = useState('');
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [migratingOrderId, setMigratingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = () => {
      fetch('/api/services', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d.success) setServices(d.services); }).catch(() => {}).finally(() => setServicesLoaded(true));
    };
    fetchServices();
    const servicesInterval = setInterval(fetchServices, 60000);

    fetch('/api/stocks/public', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d.success) setStocks(d.stocks); });

    // Vérifier la session client
    fetch('/api/client/me', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.authenticated) {
        setCustomer(d.customer);
        setOrders(d.orders || []);
        setSearchedEmail(d.customer.email);
        if (d.orders?.length > 0 && d.orders[0].chats) setActiveChatOrderId(d.orders[0].id);
      }
      setAuthChecked(true);
    });

    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') && params.get('email')) {
        setView('dashboard');
      }
      if (params.get('verify') === 'success') {
        setView('dashboard');
        setAuthMsg('✅ Email confirmé ! Vous êtes connecté.');
      } else if (params.get('verify') === 'invalid') {
        setView('dashboard');
        setAuthError('Lien de vérification invalide ou expiré.');
      }
      const rt = params.get('reset');
      if (rt) {
        setView('dashboard');
        setAuthMode('reset');
        setResetToken(rt);
      }
      if (params.get('migrated') === 'true') {
        setView('dashboard');
        setCancelSuccess('Prélèvement automatique activé. Votre carte est enregistrée pour les prochains paiements.');
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('from') === 'portal') {
        setView('dashboard');
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    return () => {
      clearInterval(servicesInterval);
    };
  }, []);

  const doForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setAuthMsg(''); setAuthLoading(true);
    try {
      const r = await fetch('/api/client/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail }),
      });
      const d = await r.json();
      if (d.success) {
        setAuthMsg('✅ Si cet email est associé à un compte, un lien de réinitialisation vient de vous être envoyé. Consultez votre boîte mail.');
      } else {
        setAuthError(d.error || 'Erreur');
      }
    } finally { setAuthLoading(false); }
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setAuthMsg(''); setAuthLoading(true);
    try {
      const r = await fetch('/api/client/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: authPassword }),
      });
      const d = await r.json();
      if (d.success) {
        await reloadMe();
        setAuthPassword(''); setResetToken(''); setAuthMode('login');
        setAuthMsg('✅ Mot de passe mis à jour. Vous êtes connecté.');
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        setAuthError(d.error || 'Lien invalide ou expiré.');
      }
    } finally { setAuthLoading(false); }
  };

  const reloadMe = async () => {
    const r = await fetch('/api/client/me', { cache: 'no-store' });
    const d = await r.json();
    if (d.authenticated) {
      setCustomer(d.customer);
      setOrders(d.orders || []);
      setSearchedEmail(d.customer.email);
    }
  };

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setAuthMsg(''); setAuthLoading(true);
    try {
      const r = await fetch('/api/client/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const d = await r.json();
      if (d.success) {
        setAuthMsg('✅ Compte créé ! Consultez votre email pour activer votre compte.');
        setAuthPassword('');
      } else {
        setAuthError(d.error || 'Erreur');
      }
    } finally { setAuthLoading(false); }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setAuthMsg(''); setAuthLoading(true);
    try {
      const r = await fetch('/api/client/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const d = await r.json();
      if (d.success) {
        await reloadMe();
        setAuthEmail(''); setAuthPassword('');
      } else {
        setAuthError(d.error || 'Identifiants incorrects');
      }
    } finally { setAuthLoading(false); }
  };

  const doLogout = async () => {
    await fetch('/api/client/logout', { method: 'POST' });
    setCustomer(null);
    setOrders([]);
    setSearchedEmail('');
    setActiveChatOrderId(null);
  };

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const doDeleteAccount = async () => {
    setDeleteError('');
    if (deleteConfirm.trim().toLowerCase() !== 'supprimer') {
      setDeleteError('Veuillez taper exactement "supprimer" pour confirmer.');
      return;
    }
    setDeleting(true);
    try {
      const r = await fetch('/api/client/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirm }),
      });
      const d = await r.json();
      if (d.success) {
        setCustomer(null);
        setOrders([]);
        setSearchedEmail('');
        setActiveChatOrderId(null);
        setDeleteConfirm('');
        setDashTab('orders');
        setAuthMode('login');
        setAuthMsg('Votre compte a été définitivement supprimé.');
      } else {
        setDeleteError(d.error || 'Erreur lors de la suppression du compte');
      }
    } catch {
      setDeleteError('Erreur réseau');
    } finally {
      setDeleting(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const r = await fetch('/api/client/billing-portal', { method: 'POST' });
      const d = await r.json();
      if (d.success && d.url) {
        window.location.href = d.url;
      } else {
        alert(d.error || 'Impossible d\'ouvrir le portail de paiement');
      }
    } finally { setPortalLoading(false); }
  };

  const migrateOrder = async (orderId: string) => {
    setMigratingOrderId(orderId);
    try {
      const r = await fetch('/api/client/migrate-to-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const d = await r.json();
      if (d.success && d.url) {
        window.location.href = d.url;
      } else {
        alert(d.error || 'Erreur de migration');
      }
    } finally { setMigratingOrderId(null); }
  };

  const doCancelOrder = async () => {
    if (!cancelOrderId || cancellingOrder) return;
    setCancellingOrder(true);
    setCancelError('');
    try {
      const r = await fetch('/api/client/cancel-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: cancelOrderId }),
      });
      const d = await r.json();
      if (d.success) {
        setCancelSuccess(`Résiliation confirmée. Votre accès reste actif jusqu'au ${new Date(d.effectiveAt).toLocaleDateString('fr-FR')}.`);
        setCancelOrderId(null);
        await reloadMe();
      } else {
        setCancelError(d.error || 'Erreur lors de la résiliation');
      }
    } catch {
      setCancelError('Erreur réseau');
    } finally {
      setCancellingOrder(false);
    }
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchOrders = async (email: string) => {
    setLoadingOrders(true);
    setOrdersError('');
    try {
      const r = await fetch(`/api/client/orders?email=${encodeURIComponent(email)}`);
      const d = await r.json();
      if (d.success) {
        setOrders(d.orders);
        setSearchedEmail(email);
        if (d.orders.length > 0 && d.orders[0].chats) {
          setActiveChatOrderId(d.orders[0].id);
        }
      } else {
        setOrdersError(d.error || 'Erreur lors de la récupération');
      }
    } catch {
      setOrdersError('Erreur réseau');
    } finally {
      setLoadingOrders(false);
    }
  };
  void fetchOrders;

  const fetchChat = async (orderId: string) => {
    try {
      const r = await fetch(`/api/chat?orderId=${orderId}`);
      const d = await r.json();
      if (d.success && d.thread) setChatMessages(d.thread.messages || []);
    } catch {}
  };

  useEffect(() => {
    if (activeChatOrderId) {
      void Promise.resolve().then(() => fetchChat(activeChatOrderId));
      chatPollRef.current = setInterval(() => fetchChat(activeChatOrderId), 5000);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [activeChatOrderId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatOrderId || sendingMsg) return;
    const text = chatInput.trim();
    setChatInput('');
    setSendingMsg(true);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: activeChatOrderId, text, sender: 'Vous' }),
      });
      await fetchChat(activeChatOrderId);
    } finally {
      setSendingMsg(false);
    }
  };

  const filteredServices = services.filter(s =>
    filter === 'all' || SERVICE_FILTERS[filter].includes(s.id)
  );

  const filteredStocks = stocks.filter(s =>
    filter === 'all' || SERVICE_FILTERS[filter].includes(s.serviceId)
  );

  const calcTotal = Object.entries(calcSel).reduce((sum, [id, on]) => {
    if (!on) return sum;
    const svc = services.find(s => s.id === id);
    return sum + (svc?.price || 0);
  }, 0);

  const calcOriginal = Object.entries(calcSel).reduce((sum, [id, on]) => {
    if (!on) return sum;
    const svc = services.find(s => s.id === id);
    return sum + (svc?.original || 0);
  }, 0);

  const calcSavings = calcOriginal - calcTotal;
  const calcHasValidSelection = Object.entries(calcSel).some(([id, on]) =>
    on && services.some(s => s.id === id)
  );

  const faqItems = [
    {
      q: 'Comment fonctionne StreamMalin ?',
      a: 'StreamMalin souscrit des offres familiales ou multi-utilisateurs et met à votre disposition, pour une durée déterminée, un accès numérique temporaire (une place de profil ou une invitation famille). Nous gérons la configuration technique et le support. Vous bénéficiez ainsi d\'un accès à prix malin, avec des économies variables selon l\'offre disponible.',
    },
    {
      q: 'Le partage de place est-il sécurisé ?',
      a: 'Les offres familiales et multi-profils sont conçues par les éditeurs pour un usage sur plusieurs profils distincts. StreamMalin met à votre disposition un accès temporaire et personnel à l\'une de ces places : vous disposez de votre propre profil privé ou de votre invitation individuelle, et vos données restent privées. StreamMalin est un service indépendant, non affilié aux plateformes citées.',
    },
    {
      q: 'Y a-t-il un engagement sur mes abonnements ?',
      a: 'Aucun engagement de durée. Vous payez au mois le mois et pouvez résilier votre location à tout moment d\'un simple clic depuis votre Espace Client. L\'abonnement s\'arrête simplement à la fin de votre période mensuelle payée.',
    },
    {
      q: 'Que se passe-t-il si un compte cesse de fonctionner ?',
      a: 'Nous assurons le suivi des accès et une assistance en cas de dysfonctionnement. Si une difficulté survient, contactez le support afin que notre équipe analyse la situation et propose une solution adaptée selon les disponibilités.',
    },
  ];

  const slotDots = (maxSlots: number, filledSlots: number) =>
    Array.from({ length: maxSlots }, (_, i) => {
      let cls = 'slot-dot';
      if (i < filledSlots) cls += ' filled';
      else if (i === filledSlots) cls += ' available';
      return <div key={i} className={cls} />;
    });

  return (
    <div className="relative min-h-screen">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-inner">
          <button onClick={() => setView('storefront')} className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span className="gradient-text">StreamMalin</span>
          </button>

          <nav className="nav-links">
            <a href="#offres" onClick={() => setView('storefront')} className="nav-link">Offres</a>
            <a href="#marketplace" className="nav-link">Marketplace</a>
            <a href="#calculateur" className="nav-link">Calculateur</a>
            <a href="#faq" className="nav-link">FAQ</a>
            <button onClick={() => setView('dashboard')} className="btn btn-outline btn-sm" style={{ marginLeft: 8 }}>
              👤 Espace Client
            </button>
          </nav>

          <button className="md:hidden text-white text-2xl" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-3" style={{ background: 'hsla(222,44%,7%,0.95)' }}>
            <a href="#offres" onClick={() => { setView('storefront'); setMenuOpen(false); }} className="nav-link">Offres</a>
            <a href="#marketplace" onClick={() => setMenuOpen(false)} className="nav-link">Marketplace</a>
            <a href="#calculateur" onClick={() => setMenuOpen(false)} className="nav-link">Calculateur</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="nav-link">FAQ</a>
            <button onClick={() => { setView('dashboard'); setMenuOpen(false); }} className="btn btn-outline btn-sm">👤 Espace Client</button>
          </div>
        )}
      </header>

      {/* ======================== STOREFRONT ======================== */}
      {view === 'storefront' && (
        <main>
          {/* HERO */}
          <section className="hero">
            <div className="hero-orb hero-orb-1" />
            <div className="hero-orb hero-orb-2" />
            <div className="hero-orb hero-orb-3" />
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                STREAMING PREMIUM · LIVRAISON RAPIDE
              </div>
              <h1>
                Le streaming premium,<br />
                <span className="gradient-text">version maline.</span>
              </h1>
              <p className="hero-subtitle">
                Vos accès favoris à prix malin avec des remises jusqu&apos;à <strong style={{ color: '#fff' }}>75%</strong> selon les offres disponibles.
              </p>
              <div className="hero-cta">
                <a href="#offres" className="btn btn-primary btn-lg">
                  Découvrir les Offres <span style={{ fontSize: '1.2em' }}>→</span>
                </a>
                <button onClick={() => setView('dashboard')} className="btn btn-outline btn-lg">
                  👤 Mon Espace Client
                </button>
              </div>
              <div className="hero-trust">
                <span><span className="check">✓</span> Support client réactif en français</span>
                <span><span className="check">✓</span> Livraison rapide après validation</span>
                <span><span className="check">✓</span> Sans engagement</span>
                <span><span className="check">✓</span> Paiement via prestataires spécialisés</span>
              </div>
            </div>
          </section>

          {/* CATALOGUE */}
          <section id="offres" className="section">
            <div className="section-inner">
              <div className="section-head">
                <div className="section-eyebrow">— Catalogue —</div>
                <h2 className="section-title">
                  Tous vos <span className="gradient-text">abonnements préférés</span>
                </h2>
                <p className="section-subtitle">Sélectionnez votre service. Les accès sont transmis après validation de la commande, selon disponibilité.</p>
              </div>

              <div className="filters">
                {([['all', '✨ Tous'], ['streaming', '📺 Streaming Vidéo'], ['musique', '🎵 Musique'], ['securite', '🛡️ Sécurité & VPN']] as [FilterType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`filter-btn ${filter === key ? 'active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="products-grid fade-in-up-stagger">
                {filteredServices.map((s) => {
                  const discount = Math.round((1 - s.price / s.original) * 100);
                  const savings = (s.original - s.price).toFixed(2);
                  const hasStock = s.availableSlots > 0;
                  return (
                    <div key={s.id} className="product-card glass-panel">
                      {/* Banner */}
                      <div className="product-banner" style={{ background: s.gradient }}>
                        <span className="badge-discount">-{discount}%</span>
                        <div className="product-logo">{s.icon}</div>
                      </div>
                      {/* Body */}
                      <div className="product-body">
                        <h3>{s.name}</h3>
                        <p className="tagline">{s.tagline}</p>
                        <ul className="features">
                          {s.features.slice(0, 3).map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                        <div className="pricing">
                          <div>
                            <span className="price-main">{s.price.toFixed(2)}€</span>
                            <span className="price-original">{s.original.toFixed(2)}€</span>
                            <span className="price-period">/ mois</span>
                          </div>
                          <p className="price-savings">Économie : {savings}€/mois</p>
                        </div>
                        {hasStock ? (
                          <a
                            href={`/checkout?service=${s.id}&stock=${s.availableStockId}`}
                            className="product-cta"
                          >
                            Louer un accès →
                          </a>
                        ) : (
                          <button disabled className="product-cta disabled">
                            Aucune place disponible
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!servicesLoaded && (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="product-card glass-panel" style={{ opacity: 0.5, pointerEvents: 'none' }}>
                        <div className="product-banner" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        <div className="product-body">
                          <div style={{ height: 18, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />
                          <div style={{ height: 12, width: '80%', borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 6 }} />
                          <div style={{ height: 12, width: '50%', borderRadius: 6, background: 'rgba(255,255,255,0.04)', marginBottom: 20 }} />
                          <div style={{ height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)' }} />
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {servicesLoaded && filteredServices.length === 0 && (
                  <div className="col-span-4 text-center py-12 text-[#9ca3af] font-light">Aucun service disponible dans cette catégorie.</div>
                )}
              </div>
            </div>
          </section>

          {/* MARKETPLACE */}
          <section id="marketplace" className="section section-alt">
            <div className="section-inner">
              <div className="section-head">
                <div className="section-eyebrow">— Marketplace en direct —</div>
                <h2 className="section-title">
                  Places <span className="gradient-text">disponibles maintenant</span>
                </h2>
                <p className="section-subtitle">Vos accès sont suivis par notre équipe, avec assistance en cas de dysfonctionnement.</p>
              </div>

              <div className="shares-list fade-in-up-stagger">
                {filteredStocks.length === 0 ? (
                  <div className="glass-panel" style={{ borderRadius: 'var(--radius)', padding: '52px 32px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(138,92,247,0.12)', border: '1px solid rgba(138,92,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-white)', marginBottom: 8 }}>Aucune place disponible</h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-gray)', lineHeight: 1.65, marginBottom: 20 }}>
                      Toutes les places de ce service sont momentanément occupées.<br />
                      Revenez bientôt ou contactez-nous pour être prévenu des prochaines disponibilités.
                    </p>
                    <button
                      onClick={() => setView('dashboard')}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.82rem' }}
                    >
                      💬 Contacter le support
                    </button>
                  </div>
                ) : (
                  filteredStocks.map((stock) => {
                    const avSlots = stock.maxSlots - stock.filledSlots;
                    return (
                      <div key={stock.id} className="share-item glass-panel">
                        <div className="share-logo-wrap" style={{ background: stock.service.gradient }}>
                          {stock.service.icon}
                        </div>
                        <div className="share-details">
                          <div className="share-name">{stock.service.name}</div>
                          <div className="share-tag">🛡️ Accès suivi · Assistance incluse</div>
                          <div className="share-slots">
                            <span className="slots-label">{avSlots} place{avSlots > 1 ? 's' : ''} libre{avSlots > 1 ? 's' : ''}</span>
                            <div className="share-dots">
                              {slotDots(stock.maxSlots, stock.filledSlots)}
                            </div>
                          </div>
                        </div>
                        <div className="share-price">
                          <span className="price-val">{stock.price.toFixed(2)}€</span>
                          <span className="price-sub">/mois selon offre</span>
                        </div>
                        <a
                          href={`/checkout?service=${stock.serviceId}&stock=${stock.id}`}
                          className="btn btn-primary btn-sm shrink-0"
                        >
                          Louer →
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* CALCULATEUR D'ÉCONOMIES */}
          <section id="calculateur" className="section">
            <div className="section-inner" style={{ maxWidth: 1100 }}>
              <div className="section-head">
                <div className="section-eyebrow">— Comparateur de prix —</div>
                <h2 className="section-title">
                  Pourquoi payer le <span className="gradient-text">tarif plein</span> ?
                </h2>
                <p className="section-subtitle">Comparez les tarifs publics indicatifs avec les prix proposés par StreamMalin selon les offres disponibles.</p>
              </div>

              <div className="glass-panel comparison">
                <div className="comparison-row comparison-head">
                  <div>Service</div>
                  <div style={{ textAlign: 'center' }}>Tarif Public</div>
                  <div style={{ textAlign: 'center' }}>StreamMalin</div>
                  <div style={{ textAlign: 'center' }}>Économie</div>
                </div>

                {services.map((s) => {
                  const savings = (s.original - s.price).toFixed(2);
                  const pct = Math.round((1 - s.price / s.original) * 100);
                  return (
                    <div key={s.id} className="comparison-row">
                      <div className="comparison-service">
                        <div className="comparison-icon" style={{ background: s.gradient }}>{s.icon}</div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '0.92rem' }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.tagline.slice(0, 38)}</div>
                        </div>
                      </div>
                      <div className="comparison-price-old">{s.original.toFixed(2)}€/m</div>
                      <div className="comparison-price-new">{s.price.toFixed(2)}€/m</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <span className="comparison-badge">-{pct}% · {savings}€/m</span>
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 36, paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: 16, fontFamily: "'Outfit',sans-serif" }}>
                    🧮 <span className="gradient-text">Calculateur d&apos;économies</span> personnalisé
                  </h3>
                  <div className="calc-chips">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setCalcSel(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                        className={`calc-chip ${calcSel[s.id] ? 'active' : ''}`}
                      >
                        <span>{s.icon}</span> {s.name}
                      </button>
                    ))}
                  </div>
                  {calcHasValidSelection ? (
                    <>
                      <div className="calc-result">
                        <div className="calc-tile">
                          <div className="calc-tile-label">Tarif public</div>
                          <div className="calc-tile-value" style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{calcOriginal.toFixed(2)}€</div>
                        </div>
                        <div className="calc-tile" style={{ background: 'linear-gradient(135deg, rgba(138,92,247,0.1), rgba(99,102,241,0.05))', borderColor: 'rgba(138,92,247,0.25)' }}>
                          <div className="calc-tile-label">Avec StreamMalin</div>
                          <div className="calc-tile-value gradient-text">{calcTotal.toFixed(2)}€</div>
                        </div>
                        <div className="calc-tile">
                          <div className="calc-tile-label">Vous économisez</div>
                          <div className="calc-tile-value" style={{ color: 'var(--accent-green)' }}>{calcSavings.toFixed(2)}€/m</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-gray)' }}>
                          Sur l&apos;année, vous économisez{' '}
                          <strong className="gradient-text" style={{ fontSize: '1.05rem' }}>{(calcSavings * 12).toFixed(0)}€</strong>.
                        </p>
                        <a href="#offres" className="btn btn-primary btn-sm">
                          Choisir mes abonnements
                        </a>
                      </div>
                    </>
                  ) : (
                    <div style={{ marginTop: 18, padding: '18px 24px', borderRadius: 'var(--radius)', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', fontSize: '0.88rem' }}>
                      👆 Sélectionnez une ou plusieurs offres ci-dessus pour voir vos économies en temps réel.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* COMMENT ÇA MARCHE */}
          <section id="comment" className="section section-alt">
            <div className="section-inner" style={{ maxWidth: 1100 }}>
              <div className="section-head">
                <div className="section-eyebrow">— Mode d&apos;emploi —</div>
                <h2 className="section-title">
                  Comment ça <span className="gradient-text">marche</span> ?
                </h2>
                <p className="section-subtitle">Le partage d&apos;abonnement en 3 étapes simples.</p>
              </div>
              <div className="steps-grid fade-in-up-stagger">
                {[
                  { n: '1', title: 'Sélectionnez une offre', text: 'Parcourez notre catalogue et choisissez l\'offre qui correspond à vos besoins parmi nos services premium.' },
                  { n: '2', title: 'Réglez en sécurité', text: 'Payez chaque mois par carte bancaire, PayPal (Biens & Services) ou cryptomonnaies via les moyens proposés.' },
                  { n: '3', title: 'Recevez votre accès', text: 'Les informations d\'accès ou le lien d\'invitation sont transmis après validation du paiement et selon disponibilité.' },
                ].map((step) => (
                  <div key={step.n} className="step-card glass-panel">
                    <div className="step-number">{step.n}</div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* GARANTIES */}
          <section className="section">
            <div className="section-inner" style={{ maxWidth: 1100 }}>
              <div className="section-head">
                <div className="section-eyebrow">— Nos engagements —</div>
                <h2 className="section-title">
                  Partagez en toute <span className="gradient-text">sérénité</span>
                </h2>
                <p className="section-subtitle">Service encadré par des CGV, avec support client dédié et non-affiliation claire aux plateformes citées.</p>
              </div>
              <div className="guarantees-grid fade-in-up-stagger">
                {[
                  {
                    svg: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                    title: 'Suivi des accès', text: 'Assistance en cas de dysfonctionnement et traitement des demandes selon les CGV.',
                  },
                  {
                    svg: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                    title: 'Identifiants Chiffrés', text: 'Vos mots de passe et liens de connexion sont chiffrés avec la norme AES-256.',
                  },
                  {
                    svg: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                    title: 'Livraison rapide', text: 'Votre accès est transmis après validation de la commande et selon disponibilité.',
                  },
                  {
                    svg: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                    title: 'Support client', text: 'Une équipe dédiée en français répond aux demandes liées aux commandes et aux accès.',
                  },
                ].map((g, i) => (
                  <div key={i} className="guarantee-card glass-panel">
                    <div className="guarantee-icon" style={{ color: 'var(--primary)' }}>{g.svg}</div>
                    <div className="guarantee-title">{g.title}</div>
                    <p className="guarantee-text">{g.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="section section-alt">
            <div className="section-inner" style={{ maxWidth: 820 }}>
              <div className="section-head">
                <div className="section-eyebrow">— FAQ —</div>
                <h2 className="section-title">
                  Questions <span className="gradient-text">fréquentes</span>
                </h2>
                <p className="section-subtitle">Des réponses aux questions fréquentes.</p>
              </div>
              <div className="faq-list">
                {faqItems.map((item, i) => (
                  <div key={i} className={`faq-item glass-panel ${faqOpen === i ? 'open' : ''}`}>
                    <button
                      className="faq-trigger"
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    >
                      <span>{item.q}</span>
                      <span className="faq-icon">+</span>
                    </button>
                    {faqOpen === i && (
                      <div className="faq-answer">{item.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="section">
            <div className="section-inner" style={{ maxWidth: 900 }}>
              <div className="cta-block glass-panel">
                <div className="section-eyebrow">— Dernier appel —</div>
                <h2>Prêt à réduire vos factures <span className="gradient-text" style={{ whiteSpace: 'nowrap' }}>dès aujourd&apos;hui&nbsp;?</span></h2>
                <p>Rejoignez nos clients économes. Accès transmis après validation, résiliable à tout moment, sans engagement.</p>
                <div className="cta-buttons">
                  <a href="#offres" onClick={() => setFilter('streaming')} className="btn btn-primary">▶ YouTube — dès 3,49€</a>
                  <a href="#offres" onClick={() => setFilter('streaming')} className="btn btn-outline">✦ Disney+ — dès 2,99€</a>
                  <a href="#offres" onClick={() => setFilter('securite')} className="btn btn-outline">🦈 Surfshark — dès 1,49€</a>
                </div>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <Footer />
        </main>
      )}

      {/* ======================== DASHBOARD CLIENT ======================== */}
      {view === 'dashboard' && (
        <main style={{ position: 'relative', minHeight: '100vh' }}>
          {/* Ambient glows */}
          <div style={{ position: 'absolute', top: 60, left: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, hsla(258,90%,66%,0.16), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: 300, right: '-12%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, hsla(239,84%,67%,0.1), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

          <div className="dash-wrap">
            {/* Header */}
            <div className="dash-header fade-in-up">
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 50, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '0.06em', marginBottom: 12 }}>
                  <span className="hero-badge-dot" style={{ width: 6, height: 6 }} />
                  CONNECTÉ · SESSION SÉCURISÉE
                </div>
                <h1 className="dash-title">
                  Mon <span className="gradient-text">Espace Client</span>
                </h1>
                {customer && (
                  <div className="dash-subtitle">
                    Connecté en tant que <strong style={{ color: 'var(--text-white)' }}>{customer.email}</strong>
                    {!customer.emailVerified && (
                      <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 50, background: 'rgba(255,180,0,0.15)', color: 'var(--accent-yellow)', fontSize: '0.7rem', fontWeight: 700 }}>
                        ⚠️ Email non vérifié
                      </span>
                    )}
                    <button onClick={doLogout} style={{ marginLeft: 10, color: 'var(--secondary)', fontSize: '0.78rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setView('storefront')} className="btn btn-ghost btn-sm">
                ← Boutique
              </button>
            </div>

            <div className="dash-layout">
              {/* Sidebar */}
              <aside className="glass-panel dash-sidebar">
                <button
                  onClick={() => setDashTab('orders')}
                  className={`dash-sidebar-btn ${dashTab === 'orders' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '1.05rem' }}>📦</span> Mes Abonnements
                  {orders.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 50, background: dashTab === 'orders' ? 'rgba(255,255,255,0.2)' : 'rgba(138,92,247,0.2)', fontWeight: 800 }}>
                      {orders.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDashTab('rent')}
                  className={`dash-sidebar-btn ${dashTab === 'rent' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '1.05rem' }}>🛒</span> Louer un abonnement
                </button>
                <button
                  onClick={() => setDashTab('chat')}
                  className={`dash-sidebar-btn ${dashTab === 'chat' ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '1.05rem' }}>💬</span> Support Client
                </button>

                {customer && (
                  <button
                    onClick={() => { setDashTab('settings'); setDeleteConfirm(''); setDeleteError(''); }}
                    className={`dash-sidebar-btn ${dashTab === 'settings' ? 'active' : ''}`}
                  >
                    <span style={{ fontSize: '1.05rem' }}>⚙️</span> Paramètres
                  </button>
                )}

                {customer && (
                  <button
                    onClick={doLogout}
                    className="dash-sidebar-btn"
                    style={{ color: 'var(--accent-red)' }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>🚪</span> Déconnexion
                  </button>
                )}

                <div className="dash-sidebar-divider" />

                <div className="dash-sidebar-foot">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-soft)', fontWeight: 600 }}>
                    🛡️ Sécurité
                  </div>
                  Vos accès sont chiffrés AES-256. Notre équipe ne stocke jamais vos identifiants en clair.
                </div>
              </aside>

              {/* Content */}
              <div>
                {/* Login / Register / Forgot / Reset — affiché si non authentifié */}
                {authChecked && !customer && (
                  <div className="glass-panel dash-card fade-in-up">
                    <div className="dash-card-head">
                      <div className="icon-bubble">
                        {authMode === 'login' ? '🔐' : authMode === 'register' ? '✨' : authMode === 'forgot' ? '🔑' : '🆕'}
                      </div>
                      {authMode === 'login' && 'Connexion à mon espace'}
                      {authMode === 'register' && 'Créer un compte client'}
                      {authMode === 'forgot' && 'Mot de passe oublié'}
                      {authMode === 'reset' && 'Choisir un nouveau mot de passe'}
                    </div>

                    {authMode !== 'reset' && (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 18, padding: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                        <button
                          onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMsg(''); }}
                          className="btn btn-sm"
                          style={{ flex: 1, background: authMode === 'login' ? 'var(--gradient-aurora)' : 'transparent', color: authMode === 'login' ? '#fff' : 'var(--text-gray)', border: 'none' }}
                        >
                          🔐 Connexion
                        </button>
                        <button
                          onClick={() => { setAuthMode('register'); setAuthError(''); setAuthMsg(''); }}
                          className="btn btn-sm"
                          style={{ flex: 1, background: authMode === 'register' ? 'var(--gradient-aurora)' : 'transparent', color: authMode === 'register' ? '#fff' : 'var(--text-gray)', border: 'none' }}
                        >
                          ✨ Inscription
                        </button>
                      </div>
                    )}

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: 18 }}>
                      {authMode === 'login' && 'Accédez à vos abonnements actifs, vos identifiants chiffrés et au support.'}
                      {authMode === 'register' && 'Créez un compte pour gérer vos locations. Un email de confirmation vous sera envoyé.'}
                      {authMode === 'forgot' && 'Saisissez votre email, nous vous enverrons un lien pour choisir un nouveau mot de passe.'}
                      {authMode === 'reset' && 'Saisissez votre nouveau mot de passe ci-dessous (6 caractères minimum).'}
                    </p>

                    {(authMode === 'login' || authMode === 'register') && (
                      <form onSubmit={authMode === 'login' ? doLogin : doRegister} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          type="email"
                          placeholder="vous@exemple.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="dash-input"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Mot de passe (6 caractères min.)"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="dash-input"
                          minLength={6}
                          required
                        />
                        <button type="submit" disabled={authLoading} className="btn btn-primary">
                          {authLoading ? '⏳ Veuillez patienter…' : (authMode === 'login' ? 'Se connecter →' : 'Créer mon compte →')}
                        </button>
                        {authMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthMsg(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.82rem', textDecoration: 'underline', cursor: 'pointer', marginTop: 4 }}
                          >
                            Mot de passe oublié ?
                          </button>
                        )}
                      </form>
                    )}

                    {authMode === 'forgot' && (
                      <form onSubmit={doForgot} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          type="email"
                          placeholder="vous@exemple.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="dash-input"
                          required
                        />
                        <button type="submit" disabled={authLoading} className="btn btn-primary">
                          {authLoading ? '⏳ Envoi…' : '📧 Envoyer le lien de réinitialisation'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMsg(''); }}
                          style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.82rem', textDecoration: 'underline', cursor: 'pointer', marginTop: 4 }}
                        >
                          ← Retour à la connexion
                        </button>
                      </form>
                    )}

                    {authMode === 'reset' && (
                      <form onSubmit={doReset} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          type="password"
                          placeholder="Nouveau mot de passe (6 caractères min.)"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="dash-input"
                          minLength={6}
                          required
                        />
                        <button type="submit" disabled={authLoading} className="btn btn-primary">
                          {authLoading ? '⏳ Mise à jour…' : '🔑 Définir ce nouveau mot de passe'}
                        </button>
                      </form>
                    )}

                    {authError && (
                      <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: 12, padding: '8px 12px', background: 'rgba(255,80,80,0.08)', borderRadius: 8 }}>
                        ⚠️ {authError}
                      </p>
                    )}
                    {authMsg && (
                      <p style={{ color: 'var(--accent-green)', fontSize: '0.8rem', marginTop: 12, padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
                        {authMsg}
                      </p>
                    )}
                  </div>
                )}

                {/* Onglet Louer un abonnement */}
                {customer && dashTab === 'rent' && (
                  <div className="fade-in-up">
                    <div className="glass-panel dash-card" style={{ marginBottom: 20 }}>
                      <div className="dash-card-head">
                        <div className="icon-bubble">🛒</div>
                        Louer un nouvel abonnement
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>
                        Choisissez un service ci-dessous. Vous serez redirigé vers le paiement avec votre email pré-rempli.
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      {services.map((s) => {
                        const hasStock = s.availableSlots > 0;
                        return (
                          <div key={s.id} className="glass-panel" style={{ padding: 18 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                                {s.icon}
                              </div>
                              <div>
                                <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>{s.name}</h4>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.tagline}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-white)', marginBottom: 12 }}>
                              {s.price.toFixed(2)}€<span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}> / mois</span>
                            </div>
                            {hasStock ? (
                              <a
                                href={`/checkout?service=${s.id}&stock=${s.availableStockId}&email=${encodeURIComponent(customer.email)}`}
                                className="btn btn-primary"
                                style={{ width: '100%', textAlign: 'center' }}
                              >
                                🛒 Louer maintenant
                              </a>
                            ) : (
                              <button disabled className="btn btn-ghost" style={{ width: '100%', opacity: 0.5 }}>
                                Aucune place disponible
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Orders tab */}
                {customer && dashTab === 'orders' && (
                  <div className="fade-in-up">
                    {orders.length === 0 && !loadingOrders ? (
                      <div className="glass-panel dash-empty">
                        <div className="dash-empty-icon">📭</div>
                        <h3>Aucun abonnement actif</h3>
                        <p>Nous n&apos;avons trouvé aucune commande pour <strong style={{ color: 'var(--text-white)' }}>{searchedEmail}</strong>. Vérifiez l&apos;orthographe ou contactez le support.</p>
                      </div>
                    ) : (
                      <>
                        {cancelSuccess && (
                          <div style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--accent-green)', fontSize: '0.88rem' }}>
                            ✅ {cancelSuccess}
                          </div>
                        )}
                        {orders.map((order) => (
                          <div key={order.id} className="glass-panel order-card">
                            <div className="order-icon-lg" style={{ background: order.service.gradient }}>
                              {order.service.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{order.service.name}</h4>
                                {order.status === 'cancelled_pending' ? (
                                  <span className="order-status" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                                    Résiliation le {new Date(order.cancellationEffectiveAt!).toLocaleDateString('fr-FR')}
                                  </span>
                                ) : (
                                  <span className="order-status">Actif</span>
                                )}
                              </div>
                              <div className="order-meta">
                                <span>Mensualité <strong>{order.price.toFixed(2)}€</strong></span>
                                <span>·</span>
                                <span>Loué le <strong>{new Date(order.date).toLocaleDateString('fr-FR')}</strong></span>
                              </div>
                              <div className="creds-box">
                                <div className="creds-label">🔑 Accès de connexion</div>
                                <div className="creds-value">{order.details}</div>
                              </div>

                              {/* Carte bancaire enregistrée */}
                              {order.stripeSubscriptionId && order.cardLast4 ? (() => {
                                const now = new Date();
                                const expired = order.cardExpYear && order.cardExpMonth && (
                                  order.cardExpYear < now.getFullYear() ||
                                  (order.cardExpYear === now.getFullYear() && order.cardExpMonth < now.getMonth() + 1)
                                );
                                const expiringSoon = order.cardExpYear && order.cardExpMonth && !expired && (
                                  (order.cardExpYear - now.getFullYear()) * 12 + (order.cardExpMonth - now.getMonth() - 1) <= 1
                                );
                                return (
                                  <div style={{ marginTop: 8, marginBottom: 8, padding: 12, borderRadius: 10, background: expired ? 'rgba(239,68,68,0.08)' : expiringSoon ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)', border: `1px solid ${expired ? 'rgba(239,68,68,0.3)' : expiringSoon ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.2)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                      <div style={{ fontSize: '0.82rem' }}>
                                        💳 <strong style={{ textTransform: 'capitalize' }}>{order.cardBrand || 'Carte'}</strong> •••• {order.cardLast4} <span style={{ color: 'var(--text-muted)' }}>· expire {String(order.cardExpMonth).padStart(2, '0')}/{order.cardExpYear}</span>
                                        {expired && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 50, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.7rem', fontWeight: 800 }}>⚠️ EXPIRÉE</span>}
                                        {expiringSoon && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 50, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 800 }}>⏱️ Expire bientôt</span>}
                                      </div>
                                      {order.nextBillingAt && !expired && (
                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                          Prochain prélèvement : {new Date(order.nextBillingAt).toLocaleDateString('fr-FR')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })() : !order.stripeSubscriptionId && order.status === 'active' && (
                                <div style={{ marginTop: 8, marginBottom: 8, padding: 12, borderRadius: 10, background: 'rgba(138,92,247,0.08)', border: '1px solid rgba(138,92,247,0.25)' }}>
                                  <div style={{ fontSize: '0.82rem', marginBottom: 8 }}>
                                    ✨ <strong>Activez le prélèvement automatique</strong> pour ne plus jamais oublier de payer. Vous restez résiliable à tout moment.
                                  </div>
                                  <button
                                    onClick={() => migrateOrder(order.id)}
                                    disabled={migratingOrderId === order.id}
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: '0.78rem' }}
                                  >
                                    {migratingOrderId === order.id ? '⏳ Redirection…' : '💳 Activer le prélèvement automatique'}
                                  </button>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => { setDashTab('chat'); setActiveChatOrderId(order.id); fetchChat(order.id); }}
                                  className="btn btn-primary btn-sm"
                                >💬 Contacter le support</button>
                                <button
                                  onClick={() => navigator.clipboard.writeText(order.details)}
                                  className="btn btn-ghost btn-sm"
                                >📋 Copier les accès</button>
                                {order.stripeSubscriptionId && (
                                  <button
                                    onClick={openBillingPortal}
                                    disabled={portalLoading}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--secondary)', borderColor: 'rgba(138,92,247,0.3)' }}
                                  >{portalLoading ? '⏳' : '💳'} Gérer ma carte</button>
                                )}
                                {order.status === 'active' && (
                                  <button
                                    onClick={() => { setCancelOrderId(order.id); setCancelError(''); }}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)' }}
                                  >🔴 Résilier</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Modal confirmation résiliation */}
                        {cancelOrderId && (() => {
                          const order = orders.find(o => o.id === cancelOrderId);
                          if (!order) return null;
                          const effectiveAt = new Date(order.date);
                          effectiveAt.setDate(effectiveAt.getDate() + 30);
                          return (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', padding: 20 }}>
                              <div className="glass-panel" style={{ maxWidth: 460, width: '100%', padding: 30 }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 8 }}>🔴 Résilier mon abonnement</h3>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 12 }}>
                                  Vous êtes sur le point de résilier votre abonnement <strong style={{ color: 'var(--text-white)' }}>{order.service.name}</strong>.
                                </p>
                                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16, fontSize: '0.85rem', lineHeight: 1.7 }}>
                                  ⚠️ <strong>Sans engagement</strong> — votre accès reste <strong>actif jusqu&apos;au {effectiveAt.toLocaleDateString('fr-FR')}</strong> (30 jours après souscription). Un email de confirmation vous sera envoyé.
                                </div>
                                {cancelError && (
                                  <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.82rem' }}>
                                    {cancelError}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <button
                                    onClick={doCancelOrder}
                                    disabled={cancellingOrder}
                                    className="btn"
                                    style={{ flex: 1, background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', fontWeight: 800, border: 'none' }}
                                  >
                                    {cancellingOrder ? 'Traitement…' : 'Confirmer la résiliation'}
                                  </button>
                                  <button
                                    onClick={() => { setCancelOrderId(null); setCancelError(''); }}
                                    className="btn btn-ghost"
                                    style={{ flex: 1 }}
                                  >Annuler</button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* Settings tab */}
                {customer && dashTab === 'settings' && (
                  <div className="glass-panel dash-card fade-in-up">
                    <div className="dash-card-head">
                      <div className="icon-bubble">⚙️</div>
                      Paramètres du compte
                    </div>

                    <div style={{ marginBottom: 24, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Adresse email</div>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-white)', fontWeight: 600 }}>{customer.email}</div>
                    </div>

                    <div style={{ marginTop: 30, padding: 20, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--accent-red)', fontWeight: 800, fontSize: '1rem' }}>
                        ⚠️ Zone dangereuse — Supprimer mon compte
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: 8 }}>
                        Cette action est <strong style={{ color: 'var(--accent-red)' }}>définitive et irréversible</strong>. Votre compte client, votre adresse email et votre mot de passe seront <strong>supprimés immédiatement</strong> de nos serveurs.
                      </p>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                        Vos abonnements actifs ne seront <strong>pas annulés</strong> — ils restent gérés via votre adresse email. En revanche, vous perdrez l&apos;accès à votre Espace Client et à l&apos;historique de vos conversations support.
                      </p>

                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 6, fontWeight: 600 }}>
                        Pour confirmer, tapez <code style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 800 }}>supprimer</code> ci-dessous :
                      </label>
                      <input
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
                        placeholder="Tapez supprimer"
                        className="input"
                        style={{ width: '100%', marginBottom: 12, borderColor: deleteConfirm.trim().toLowerCase() === 'supprimer' ? 'var(--accent-red)' : undefined }}
                        disabled={deleting}
                      />

                      {deleteError && (
                        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)', fontSize: '0.82rem' }}>
                          {deleteError}
                        </div>
                      )}

                      <button
                        onClick={doDeleteAccount}
                        disabled={deleting || deleteConfirm.trim().toLowerCase() !== 'supprimer'}
                        className="btn"
                        style={{
                          width: '100%',
                          background: deleteConfirm.trim().toLowerCase() === 'supprimer' && !deleting ? 'linear-gradient(135deg, #dc2626, #991b1b)' : 'rgba(239,68,68,0.2)',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: deleteConfirm.trim().toLowerCase() === 'supprimer' && !deleting ? 'pointer' : 'not-allowed',
                          opacity: deleteConfirm.trim().toLowerCase() === 'supprimer' && !deleting ? 1 : 0.5,
                          border: 'none',
                        }}
                      >
                        {deleting ? 'Suppression en cours…' : '🗑️ Supprimer définitivement mon compte'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat tab */}
                {customer && dashTab === 'chat' && (
                  <div className="glass-panel chat-card fade-in-up">
                    {orders.length === 0 ? (
                      <div className="dash-empty" style={{ borderRadius: 0 }}>
                        <div className="dash-empty-icon">💬</div>
                        <h3>Aucun abonnement actif</h3>
                        <p>Pour discuter avec le support, vous devez d&apos;abord louer un abonnement.</p>
                      </div>
                    ) : (
                      <div className="chat-layout">
                        {/* Conversations list */}
                        <aside className="chat-conv-list">
                          <div className="chat-conv-list-head">
                            <span>📨 Conversations</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{orders.length}</span>
                          </div>
                          {orders.map(order => {
                            const lastMsg = order.chats?.messages?.[order.chats.messages.length - 1];
                            const isActive = order.id === activeChatOrderId;
                            return (
                              <button
                                key={order.id}
                                onClick={() => { setActiveChatOrderId(order.id); fetchChat(order.id); }}
                                className={`chat-conv-item ${isActive ? 'active' : ''}`}
                              >
                                <div className="chat-conv-icon" style={{ background: order.service.gradient }}>
                                  {order.service.icon}
                                </div>
                                <div className="chat-conv-body">
                                  <div className="chat-conv-row">
                                    <span className="chat-conv-name">Support {order.service.name}</span>
                                    {lastMsg && (
                                      <span className="chat-conv-time">
                                        {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="chat-conv-preview">
                                    {lastMsg ? lastMsg.text : 'Démarrer une conversation…'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </aside>

                        {/* Active chat */}
                        <div className="chat-pane">
                          {!activeChatOrderId ? (
                            <div className="dash-empty" style={{ borderRadius: 0, padding: '60px 20px' }}>
                              <div className="dash-empty-icon">💬</div>
                              <h3>Sélectionnez une conversation</h3>
                              <p>Choisissez un abonnement dans la liste pour démarrer ou continuer une discussion avec le support.</p>
                            </div>
                          ) : (
                            <>
                              <div className="chat-head">
                                <div>
                                  <div className="status-online">
                                    Support StreamMalin ({orders.find(o => o.id === activeChatOrderId)?.service.name || 'Service'})
                                  </div>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🔒 Messagerie chiffrée SSL</span>
                              </div>
                              <div className="chat-messages">
                                {chatMessages.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                                    Démarrez la conversation en envoyant un message.
                                  </div>
                                ) : (
                                  chatMessages.map((msg) => {
                                    const isSelf = msg.sender === 'Vous';
                                    return (
                                      <div key={msg.id} className={`chat-msg ${isSelf ? 'self' : 'other'}`}>
                                        {!isSelf && <div className="chat-msg-sender">{msg.sender}</div>}
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                        <span className="chat-msg-time">
                                          {new Date(msg.createdAt).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                                <div ref={chatBottomRef} />
                              </div>
                              <form onSubmit={sendMessage} className="chat-input-bar">
                                <input
                                  type="text"
                                  placeholder="Tapez votre message pour le support…"
                                  value={chatInput}
                                  onChange={(e) => setChatInput(e.target.value)}
                                  className="dash-input"
                                  style={{ flex: 1 }}
                                />
                                <button
                                  type="submit"
                                  disabled={sendingMsg || !chatInput.trim()}
                                  className="btn btn-primary"
                                  style={{ opacity: sendingMsg || !chatInput.trim() ? 0.5 : 1 }}
                                >
                                  Envoyer
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

    </div>
  );
}
