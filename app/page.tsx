'use client';

import React, { useState, useEffect, useRef } from 'react';
import OfferCard from '@/components/OfferCard';
import StreamingStorefront from '@/components/StreamingStorefront';
import { Menu, X, UserRound, Eye, EyeOff, LockKeyhole } from 'lucide-react';

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
  referenceVerified?: boolean;
  eligibility?: string;
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

export default function Home() {
  const [view, setView] = useState<View>('storefront');
  const [dashTab, setDashTab] = useState<DashTab>('orders');

  const goToDashboard = () => {
    setView('dashboard');
    window.history.replaceState({}, '', '/espace-client');
    window.scrollTo(0, 0);
  };
  const goToStorefront = () => {
    setView('storefront');
    window.history.replaceState({}, '', '/');
  };
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Espace client (auth)
  const [authChecked, setAuthChecked] = useState(false);
  const [customer, setCustomer] = useState<{ id: string; email: string; emailVerified: boolean } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendingVerif, setResendingVerif] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const [searchedEmail, setSearchedEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
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

  const loadCatalog = async () => {
    try {
      const response = await fetch('/api/services', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.services)) throw new Error('Catalogue indisponible');
      setServices(data.services.filter((s: Service) => Number.isFinite(s.price) && s.price > 0 && Number.isFinite(s.original) && s.original > 0));
      setCatalogError('');
    } catch {
      setCatalogError('Le catalogue est temporairement indisponible. Réessayez dans quelques instants.');
      setServices([]);
    } finally { setServicesLoaded(true); }
  };
  useEffect(() => {
    void Promise.resolve().then(() => { void loadCatalog(); });
    const servicesInterval = setInterval(() => { void loadCatalog(); }, 60000);

    // Vérifier la session client
    fetch('/api/client/me', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (d.authenticated) {
        setCustomer(d.customer);
        setOrders(d.orders || []);
        setSearchedEmail(d.customer.email);
        if (d.orders?.length > 0 && d.orders[0].chats) setActiveChatOrderId(d.orders[0].id);
      }
      setAuthChecked(true);
    }).catch(() => setOrdersError('Votre espace client est temporairement indisponible.')).finally(() => setAuthChecked(true));

    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      // /espace-client redirige ici avec ce param pour activer le dashboard
      if (params.get('espace-client') === '1' || window.location.pathname === '/espace-client') {
        setView('dashboard');
        window.history.replaceState({}, '', '/espace-client');
      }
      if (params.get('success') && params.get('session_id')) {
        window.location.replace(`/commande/confirmee?session_id=${encodeURIComponent(params.get('session_id')!)}`);
      }
      if (params.get('verify') === 'success') {
        setView('dashboard');
        setAuthMsg('✅ Email confirmé ! Vous êtes connecté.');
        window.history.replaceState({}, '', '/espace-client');
      } else if (params.get('verify') === 'invalid') {
        setView('dashboard');
        setAuthError('Lien de vérification invalide ou expiré.');
        window.history.replaceState({}, '', '/espace-client');
      }
      const rt = params.get('reset');
      if (rt) {
        setView('dashboard');
        setAuthMode('reset');
        setResetToken(rt);
        window.history.replaceState({}, '', '/espace-client');
      }
      if (params.get('migrated') === 'true') {
        setView('dashboard');
        setCancelSuccess('Prélèvement automatique activé. Votre carte est enregistrée pour les prochains paiements.');
        window.history.replaceState({}, '', '/espace-client');
      }
      if (params.get('from') === 'portal') {
        setView('dashboard');
        window.history.replaceState({}, '', '/espace-client');
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
    } catch { setAuthError('Le serveur est temporairement indisponible. Réessayez dans quelques instants.'); }
    finally { setAuthLoading(false); }
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
    } catch { setAuthError('Le serveur est temporairement indisponible. Réessayez dans quelques instants.'); }
    finally { setAuthLoading(false); }
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
    setAuthError(''); setAuthMsg('');
    if (authPassword !== authPasswordConfirm) {
      setAuthError('Les mots de passe ne correspondent pas.');
      return;
    }
    setAuthLoading(true);
    try {
      const r = await fetch('/api/client/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const d = await r.json();
      if (d.success) {
        setAuthMsg(d.message || 'Consultez votre boîte e-mail pour la suite.');
        setAuthPassword(''); setAuthPasswordConfirm('');
      } else {
        setAuthError(d.error || 'Erreur');
      }
    } catch { setAuthError('Le serveur est temporairement indisponible. Réessayez dans quelques instants.'); }
    finally { setAuthLoading(false); }
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
        setAuthEmail(''); setAuthPassword(''); setAuthPasswordConfirm('');
      } else {
        setAuthError(d.error || 'Identifiants incorrects');
      }
    } catch { setAuthError('Le serveur est temporairement indisponible. Réessayez dans quelques instants.'); }
    finally { setAuthLoading(false); }
  };

  const doLogout = async () => {
    await fetch('/api/client/logout', { method: 'POST' });
    setCustomer(null);
    setOrders([]);
    setSearchedEmail('');
    setActiveChatOrderId(null);
    goToStorefront();
  };

  const resendVerification = async () => {
    setResendingVerif(true);
    try {
      const r = await fetch('/api/client/resend-verification', { method: 'POST' });
      const d = await r.json();
      if (d.success) setAuthMsg('✅ Email de confirmation renvoyé. Consultez votre boîte mail.');
      else setAuthError(d.error || 'Erreur lors de l\'envoi.');
    } finally { setResendingVerif(false); }
  };

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [changePwdBusy, setChangePwdBusy] = useState(false);
  const [changePwdMsg, setChangePwdMsg] = useState('');
  const [changePwdError, setChangePwdError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [emailChangePwd, setEmailChangePwd] = useState('');
  const [changeEmailBusy, setChangeEmailBusy] = useState(false);
  const [changeEmailMsg, setChangeEmailMsg] = useState('');
  const [changeEmailError, setChangeEmailError] = useState('');

  const doChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdMsg(''); setChangePwdError('');
    setChangePwdBusy(true);
    try {
      const r = await fetch('/api/client/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const d = await r.json();
      if (d.success) {
        setChangePwdMsg('Mot de passe modifié avec succès.');
        setCurrentPwd(''); setNewPwd('');
      } else {
        setChangePwdError(d.error || 'Erreur lors du changement.');
      }
    } finally {
      setChangePwdBusy(false);
    }
  };

  const doChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeEmailMsg(''); setChangeEmailError('');
    setChangeEmailBusy(true);
    try {
      const r = await fetch('/api/client/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, currentPassword: emailChangePwd }),
      });
      const d = await r.json();
      if (d.success) {
        setChangeEmailMsg('Email de confirmation envoyé à ' + newEmail + '. Cliquez sur le lien pour valider le changement.');
        setNewEmail(''); setEmailChangePwd('');
      } else {
        setChangeEmailError(d.error || 'Erreur lors du changement.');
      }
    } finally {
      setChangeEmailBusy(false);
    }
  };

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
        body: JSON.stringify({ confirmation: deleteConfirm, currentPassword: deletePassword }),
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
        goToStorefront();
      } else {
        setDeleteError(d.error || 'Erreur lors de la suppression du compte');
      }
    } catch {
      setDeleteError('Erreur réseau');
    } finally {
      setDeletePassword('');
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


  return (
    <div className="relative min-h-screen">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-inner">
          <button onClick={goToStorefront} className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span className="gradient-text">StreamMalin</span>
          </button>

          <nav className="nav-links">
            <a href="#offres" onClick={goToStorefront} className="nav-link">Abonnements</a>
            <a href="#comment" onClick={goToStorefront} className="nav-link">Fonctionnement</a>
            <a href="#faq" onClick={goToStorefront} className="nav-link">Questions fréquentes</a>
            <a href="/contact" className="nav-link">Contact</a>
            <button onClick={goToDashboard} className="btn btn-outline btn-sm" style={{ marginLeft: 8 }}>
              <UserRound size={16} aria-hidden="true" /> Espace client
            </button>
          </nav>

          <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {menuOpen && (
          <div id="mobile-navigation" className="md:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-3" style={{ background: 'color-mix(in srgb, var(--bg-dark) 96%, transparent)' }}>
            <a href="#offres" onClick={() => { goToStorefront(); setMenuOpen(false); }} className="nav-link">Abonnements</a>
            <a href="#comment" onClick={() => { goToStorefront(); setMenuOpen(false); }} className="nav-link">Fonctionnement</a>
            <a href="#faq" onClick={() => { goToStorefront(); setMenuOpen(false); }} className="nav-link">Questions fréquentes</a>
            <a href="/contact" className="nav-link">Contact</a>
            <button onClick={() => { goToDashboard(); setMenuOpen(false); }} className="btn btn-outline btn-sm"><UserRound size={16} aria-hidden="true" /> Espace client</button>
          </div>
        )}
      </header>

      {/* Public catalogue: availability always comes from the server projection. */}
      {view === 'storefront' && <StreamingStorefront offers={services} loaded={servicesLoaded} error={catalogError} retry={() => { void loadCatalog(); }} />}

      {/* ======================== DASHBOARD CLIENT ======================== */}
      {view === 'dashboard' && (
        <main style={{ position: 'relative', minHeight: '100vh' }}>
          {/* Ambient glows */}

          <div className="dash-wrap">
            {/* Header */}
            <div className="dash-header fade-in-up">
              <div>
                <div className="dash-status-badge">
                  <span className="dash-status-dot" />
                  {customer ? 'CONNECTÉ · SESSION SÉCURISÉE' : 'ESPACE CLIENT'}
                </div>
                <h1 className="dash-title">
                  Mon <span className="gradient-text">Espace Client</span>
                </h1>
                {customer && (
                  <div className="dash-subtitle">
                    Connecté en tant que <strong style={{ color: 'var(--text-white)' }}>{customer.email}</strong>
                    {!customer.emailVerified && (
                      <>
                        <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 50, background: 'rgba(255,180,0,0.15)', color: 'var(--accent-yellow)', fontSize: '0.7rem', fontWeight: 700 }}>
                          ⚠️ Email non vérifié
                        </span>
                        <button
                          onClick={resendVerification}
                          disabled={resendingVerif}
                          style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          {resendingVerif ? '⏳ Envoi…' : 'Renvoyer l\'email'}
                        </button>
                      </>
                    )}
                    <button onClick={doLogout} style={{ marginLeft: 10, color: 'var(--secondary)', fontSize: '0.78rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
              <button onClick={goToStorefront} className="btn btn-ghost btn-sm">
                ← Boutique
              </button>
            </div>

            <div className={`dash-layout${!customer ? ' client-guest-layout' : ''}`}>
              {/* Sidebar */}
              {customer && <aside className="glass-panel dash-sidebar">
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
                    className="dash-sidebar-btn dash-sidebar-logout"
                  >
                    <span style={{ fontSize: '1.05rem' }}>🚪</span> Déconnexion
                  </button>
                )}

                <div className="dash-sidebar-divider" />

                <div className="dash-sidebar-foot">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-soft)', fontWeight: 600 }}>
                    🛡️ Sécurité
                  </div>
                  Les accès sont protégés et consultables depuis votre espace client après validation.
                </div>
              </aside>}

              {/* Content */}
              <div>
                {!authChecked && <p role="status">Chargement de votre espace client…</p>}
                {/* Login / Register / Forgot / Reset — affiché si non authentifié */}
                {authChecked && !customer && (
                  <div className="glass-panel dash-card fade-in-up">
                    <div className="dash-card-head">
                      <div className="icon-bubble">
                        <LockKeyhole size={20} aria-hidden="true" />
                      </div>
                      {authMode === 'login' && 'Connexion à mon espace'}
                      {authMode === 'register' && 'Créer un compte client'}
                      {authMode === 'forgot' && 'Mot de passe oublié'}
                      {authMode === 'reset' && 'Choisir un nouveau mot de passe'}
                    </div>

                    {authMode !== 'reset' && (
                      <div className="auth-tab-bar">
                        <button
                          onClick={() => { setAuthMode('login'); setAuthError(''); setAuthMsg(''); }}
                          className={`auth-tab-btn${authMode === 'login' ? ' active' : ''}`}
                        >
                          Connexion
                        </button>
                        <button
                          onClick={() => { setAuthMode('register'); setAuthError(''); setAuthMsg(''); }}
                          className={`auth-tab-btn${authMode === 'register' ? ' active' : ''}`}
                        >
                          Inscription
                        </button>
                      </div>
                    )}

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: 18 }}>
                      {authMode === 'login' && 'Accédez à vos abonnements actifs, vos identifiants chiffrés et au support.'}
                      {authMode === 'register' && 'Créez un compte pour gérer vos locations. Un email de confirmation vous sera envoyé.'}
                      {authMode === 'forgot' && 'Saisissez votre email, nous vous enverrons un lien pour choisir un nouveau mot de passe.'}
                      {authMode === 'reset' && 'Saisissez votre nouveau mot de passe ci-dessous (8 caractères minimum, avec une lettre et un chiffre).'}
                    </p>

                    {(authMode === 'login' || authMode === 'register') && (
                      <form onSubmit={authMode === 'login' ? doLogin : doRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-field" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor="client-auth-email">Adresse email</label>
                          <input
                            id="client-auth-email"
                            type="email"
                            placeholder="vous@exemple.com"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="dash-input"
                            autoComplete="email"
                            required
                          />
                        </div>
                        <div className="form-field" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor="client-auth-password">Mot de passe</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              id="client-auth-password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="8 caractères min., une lettre et un chiffre"
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              className="dash-input"
                              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                              minLength={8}
                              required
                              style={{ paddingRight: 44 }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(v => !v)}
                              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}
                              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                              aria-pressed={showPassword}
                            >
                              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                            </button>
                          </div>
                        </div>
                        {authMode === 'register' && (
                          <div className="form-field" style={{ marginBottom: 0 }}>
                            <label className="form-label" htmlFor="client-auth-confirm">Confirmer le mot de passe</label>
                            <input
                              id="client-auth-confirm"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Répétez votre mot de passe"
                              value={authPasswordConfirm}
                              onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                              className="dash-input"
                              autoComplete="new-password"
                              minLength={8}
                              required
                            />
                          </div>
                        )}
                        <button type="submit" disabled={authLoading} className="btn btn-primary" style={{ marginTop: 4 }}>
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
                        <label htmlFor="client-forgot-email" className="form-label">Adresse email</label>
                        <input
                          id="client-forgot-email"
                          type="email"
                          placeholder="vous@exemple.com"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="dash-input"
                          autoComplete="email"
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
                        <label htmlFor="client-reset-password" className="form-label">Nouveau mot de passe</label>
                        <input
                          id="client-reset-password"
                          type="password"
                          placeholder="Nouveau mot de passe (8 car. min., lettre + chiffre)"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="dash-input"
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                        <button type="submit" disabled={authLoading} className="btn btn-primary">
                          {authLoading ? '⏳ Mise à jour…' : '🔑 Définir ce nouveau mot de passe'}
                        </button>
                      </form>
                    )}

                    {authError && (
                      <p className="msg-error" role="alert" style={{ marginTop: 12 }}>{authError}</p>
                    )}
                    {authMsg && (
                      <p className="msg-success" role="status" style={{ marginTop: 12 }}>{authMsg}</p>
                    )}
                  </div>
                )}

                {customer && dashTab === 'rent' && <section>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: 20 }}>Louer un nouvel abonnement</h2>
                  {!servicesLoaded ? <p role="status">Chargement des abonnements…</p> : catalogError ? <p role="alert">{catalogError}</p> : services.length === 0 ? <p>Aucune place disponible actuellement. Contactez-nous pour connaître les prochaines disponibilités.</p> : <div className="stream-offer-grid">{services.map(offer => <OfferCard key={offer.id} offer={offer} />)}</div>}
                </section>}

                {/* Orders tab */}
                {customer && dashTab === 'orders' && (
                  <div className="fade-in-up">
                    {ordersError && <div className="error-box" role="alert">{ordersError}</div>}
                    {orders.length === 0 && !loadingOrders && !ordersError ? (
                      <div className="glass-panel dash-empty">
                        <div className="dash-empty-icon">📭</div>
                        <h3>Aucun abonnement actif</h3>
                        <p>Nous n&apos;avons trouvé aucune commande pour <strong style={{ color: 'var(--text-white)' }}>{searchedEmail}</strong>. Vérifiez l&apos;orthographe ou contactez le support.</p>
                      </div>
                    ) : (
                      <>
                        {cancelSuccess && (
                          <div className="msg-success" style={{ marginBottom: 16, padding: 14, borderRadius: 12, fontSize: '0.88rem' }}>
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
                          const effectiveAt = order.cancellationEffectiveAt || order.nextBillingAt;
                          return (
                            <div
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="cancel-modal-title"
                              onClick={() => { setCancelOrderId(null); setCancelError(''); }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setCancelOrderId(null); setCancelError(''); } }}
                              style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', padding: 20 }}
                            >
                              <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: '100%', padding: 30 }}>
                                <h3 id="cancel-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 8 }}>🔴 Résilier mon abonnement</h3>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 12 }}>
                                  Vous êtes sur le point de résilier votre abonnement <strong style={{ color: 'var(--text-white)' }}>{order.service.name}</strong>.
                                </p>
                                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16, fontSize: '0.85rem', lineHeight: 1.7 }}>
                                  Votre accès reste actif jusqu’à la fin de la période payée{effectiveAt && Number.isFinite(Date.parse(effectiveAt)) ? <> : <strong>{new Date(effectiveAt).toLocaleDateString('fr-FR')}</strong></> : '. La date effective sera précisée après confirmation'}. Aucun nouveau prélèvement ne doit intervenir après la date de résiliation confirmée.
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
                                    autoFocus
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
                      <div className="icon-bubble">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      </div>
                      Paramètres du compte
                    </div>

                    <div className="settings-section" style={{ padding: 16 }}>
                      <div className="settings-section-label">Adresse email</div>
                      <div className="settings-section-value">{customer.email}</div>
                    </div>

                    {/* Changement d'email */}
                    <div className="settings-section">
                      <div className="settings-section-title">Changer l&apos;adresse email</div>
                      <form onSubmit={doChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          type="email"
                          placeholder="Nouvelle adresse email"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          className="dash-input"
                          autoComplete="email"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Mot de passe actuel (pour confirmer)"
                          value={emailChangePwd}
                          onChange={e => setEmailChangePwd(e.target.value)}
                          className="dash-input"
                          autoComplete="current-password"
                          required
                        />
                        {changeEmailError && <div className="msg-error">{changeEmailError}</div>}
                        {changeEmailMsg && <div className="msg-success">{changeEmailMsg}</div>}
                        <button type="submit" disabled={changeEmailBusy} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                          {changeEmailBusy ? 'Envoi en cours…' : 'Envoyer le lien de confirmation'}
                        </button>
                      </form>
                    </div>

                    {/* Portabilité des données — RGPD Art. 20 */}
                    <div className="settings-section">
                      <div className="settings-section-title">Mes données personnelles</div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                        Conformément au RGPD (Art. 20), vous pouvez télécharger l&apos;intégralité des données liées à votre compte : profil, commandes, identifiants d&apos;accès et historique support.
                      </p>
                      <a
                        href="/api/client/export-data"
                        download
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.83rem' }}
                      >
                        Exporter mes données (JSON)
                      </a>
                    </div>

                    {/* Changement de mot de passe */}
                    <div className="settings-section">
                      <div className="settings-section-title">Changer le mot de passe</div>
                      <form onSubmit={doChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          type="password"
                          placeholder="Mot de passe actuel"
                          value={currentPwd}
                          onChange={e => setCurrentPwd(e.target.value)}
                          className="dash-input"
                          autoComplete="current-password"
                          required
                        />
                        <input
                          type="password"
                          placeholder="Nouveau mot de passe (8 car. min., lettre + chiffre)"
                          value={newPwd}
                          onChange={e => setNewPwd(e.target.value)}
                          className="dash-input"
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                        {changePwdError && <div className="msg-error">{changePwdError}</div>}
                        {changePwdMsg && <div className="msg-success">{changePwdMsg}</div>}
                        <button type="submit" disabled={changePwdBusy} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                          {changePwdBusy ? 'Enregistrement…' : 'Modifier le mot de passe'}
                        </button>
                      </form>
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

                      <label htmlFor="delete-confirm" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: 6, fontWeight: 600 }}>
                        Pour confirmer, tapez <code style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 800 }}>supprimer</code> ci-dessous :
                      </label>
                      <input
                        id="delete-confirm"
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
                        placeholder="Tapez supprimer"
                        className="input"
                        style={{ width: '100%', marginBottom: 12, borderColor: deleteConfirm.trim().toLowerCase() === 'supprimer' ? 'var(--accent-red)' : undefined }}
                        disabled={deleting}
                      />

                      <label htmlFor="delete-password" style={{ display: 'block', marginBottom: 6 }}>Mot de passe actuel</label>
                      <input
                        id="delete-password"
                        type="password"
                        value={deletePassword}
                        onChange={e => setDeletePassword(e.target.value)}
                        autoComplete="current-password"
                        maxLength={128}
                        className="input"
                        style={{ width: '100%', marginBottom: 12 }}
                        disabled={deleting}
                        required
                      />

                      {deleteError && (
                        <div className="msg-error" style={{ marginBottom: 12 }}>{deleteError}</div>
                      )}

                      <button
                        onClick={doDeleteAccount}
                        disabled={deleting || !deletePassword || deleteConfirm.trim().toLowerCase() !== 'supprimer'}
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
                                  aria-label="Message pour le support"
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
