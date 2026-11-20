'use client';

import React, { useState, useEffect, useRef } from 'react';
import OfferCard from '@/components/OfferCard';
import StreamingStorefront from '@/components/StreamingStorefront';
import SiteHeader from '@/components/SiteHeader';
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { orderStatusPresentation } from '@/lib/adminPresentation';
import { formatEuro } from '@/lib/offerPresentation';

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
  accessType?: string;
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
  price: number;
  details: string;
  status: string;
  cancellationEffectiveAt?: string | null;
  stripeManaged: boolean;
  cardLast4?: string | null;
  cardBrand?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  nextBillingAt?: string | null;
  service: { name: string; icon: string; gradient: string };
  chats?: { messages: { text: string; createdAt: string }[] } | null;
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

  // Espace client (auth)
  const [authChecked, setAuthChecked] = useState(false);
  const [customer, setCustomer] = useState<{ id: string; email: string; emailVerified: boolean } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendingVerif, setResendingVerif] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
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
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = cancelDialogRef.current;
    if (!dialog) return;
    if (cancelOrderId && !dialog.open) dialog.showModal();
    else if (!cancelOrderId && dialog.open) dialog.close();
  }, [cancelOrderId]);

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
      } else if (params.has('verify')) {
        setView('dashboard');
        setAuthError('Lien de vérification invalide ou expiré.');
        setVerificationRequested(true);
        window.history.replaceState({}, '', '/espace-client');
      }
      if (params.has('emailChange')) {
        setView('dashboard');
        if (params.get('emailChange') === 'success') setAuthMsg('Adresse e-mail confirmée. Connectez-vous avec votre nouvelle adresse.');
        else setAuthError('Ce changement d’adresse n’a pas pu être confirmé. Connectez-vous pour renouveler la demande.');
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
        setAuthMsg(d.message || 'Consultez votre boîte e-mail et les indésirables.');
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
        setVerificationRequested(true);
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
        if (d.needsVerification) setVerificationRequested(true);
      }
    } catch { setAuthError('Le serveur est temporairement indisponible. Réessayez dans quelques instants.'); }
    finally { setAuthLoading(false); }
  };

  const doLogout = async () => {
    try {
      const response = await fetch('/api/client/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout unavailable');
    } catch {
      setOrdersError('La déconnexion a échoué. Réessayez.');
      setDashTab('orders');
      return;
    }
    setOrdersError('');
    setCustomer(null);
    setOrders([]);
    setSearchedEmail('');
    setActiveChatOrderId(null);
    setChatMessages([]);
    goToStorefront();
  };

  const resendVerification = async () => {
    setResendingVerif(true); setAuthError(''); setAuthMsg('');
    try {
      const r = await fetch('/api/client/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail }),
      });
      const d = await r.json();
      if (r.ok && d.success) setAuthMsg(d.message);
      else setAuthError(d.error || 'Erreur lors de l\'envoi.');
    } catch { setAuthError('Demande indisponible. Réessayez dans quelques instants.');
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
    setOrdersError('');
    try {
      const r = await fetch('/api/client/billing-portal', { method: 'POST' });
      const d = await r.json();
      if (d.success && d.url) {
        window.location.assign(d.url);
      } else {
        setOrdersError(d.error || 'Impossible d\'ouvrir le portail de paiement.');
      }
    } catch {
      setOrdersError('Connexion indisponible. Réessayez dans quelques instants.');
    } finally { setPortalLoading(false); }
  };

  const migrateOrder = async (orderId: string) => {
    setMigratingOrderId(orderId);
    setOrdersError('');
    try {
      const r = await fetch('/api/client/migrate-to-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const d = await r.json();
      if (d.success && d.url) {
        window.location.assign(d.url);
      } else {
        setOrdersError(d.error || 'Le passage au prélèvement automatique est indisponible.');
      }
    } catch {
      setOrdersError('Connexion indisponible. Réessayez dans quelques instants.');
    } finally { setMigratingOrderId(null); }
  };

  const copyOrderDetails = async (orderId: string, details: string) => {
    try {
      await navigator.clipboard.writeText(details);
      setCopiedOrderId(orderId);
      setTimeout(() => setCopiedOrderId(current => current === orderId ? null : current), 2000);
    } catch {
      setOrdersError('La copie est indisponible. Sélectionnez et copiez vos accès manuellement.');
    }
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
      const r = await fetch('/api/client/orders');
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
    <div className="site-theme relative min-h-screen">
      <SiteHeader
        account={view === 'dashboard'}
        onHome={() => { if (view === 'dashboard') goToStorefront(); window.scrollTo(0, 0); }}
        onAccount={goToDashboard}
      />

      {/* Public catalogue: availability always comes from the server projection. */}
      {view === 'storefront' && <StreamingStorefront offers={services} loaded={servicesLoaded} error={catalogError} retry={() => { void loadCatalog(); }} />}

      {/* ======================== DASHBOARD CLIENT ======================== */}
      {view === 'dashboard' && (
        <main className="site-client">

          <div className="dash-wrap">
            {/* Header */}
            <div className="dash-header">
              <div>
                <h1 className="dash-title">Espace client</h1>
                {customer && (
                  <div className="dash-subtitle">
                    Connecté en tant que <strong style={{ color: 'var(--text-white)' }}>{customer.email}</strong>
                    <button onClick={doLogout} style={{ marginLeft: 10, color: 'var(--secondary)', fontSize: '0.78rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
              <button onClick={goToStorefront} className="btn btn-ghost btn-sm">
                <ArrowLeft size={16} aria-hidden="true" /> Boutique
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
                    <span style={{ fontSize: '1.05rem' }}>🚪</span> Déconnecter tous les appareils
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
                              placeholder={authMode === 'login' ? 'Votre mot de passe' : '8 caractères minimum'}
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
                            className="auth-link-btn"
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
                          className="auth-link-btn"
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

                    {authMode !== 'reset' && <div style={{ marginTop: 16 }}>
                      {verificationRequested ? <form onSubmit={event => { event.preventDefault(); void resendVerification(); }} style={{ display: 'grid', gap: 10 }}>
                        <label className="form-label" htmlFor="verification-email">Adresse e-mail à confirmer</label>
                        <input id="verification-email" type="email" autoComplete="email" className="dash-input" required maxLength={254} value={authEmail} onChange={event => setAuthEmail(event.target.value)} />
                        <button type="submit" className="btn btn-outline" disabled={resendingVerif || authLoading}>{resendingVerif ? 'Demande en cours…' : 'Renvoyer la confirmation'}</button>
                      </form> : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVerificationRequested(true)}>E-mail de confirmation non reçu ?</button>}
                    </div>}
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
                        {orders.map((order) => {
                          const statusInfo = orderStatusPresentation(order.status);
                          const hasValidCancelDate = order.status === 'cancelled_pending' && Boolean(order.cancellationEffectiveAt) && Number.isFinite(Date.parse(order.cancellationEffectiveAt!));
                          return (
                          <div key={order.id} className="glass-panel order-card">
                            <div className="order-icon-lg" style={{ background: order.service.gradient }}>
                              {order.service.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{order.service.name}</h4>
                                <span className={`order-status order-status-${statusInfo.tone}`}>
                                  {hasValidCancelDate
                                    ? `Résiliation le ${new Date(order.cancellationEffectiveAt!).toLocaleDateString('fr-FR')}`
                                    : statusInfo.label}
                                </span>
                              </div>
                              <div className="order-meta">
                                <span>Mensualité <strong>{formatEuro(order.price)}</strong></span>
                                <span>·</span>
                                <span>Loué le <strong>{new Date(order.date).toLocaleDateString('fr-FR')}</strong></span>
                              </div>
                              <div className="creds-box">
                                <div className="creds-label">🔑 Accès de connexion</div>
                                <div className="creds-value">
                                  {order.details || (
                                    order.status === 'pending'
                                      ? 'En attente de validation du paiement.'
                                      : ['cancelled', 'cancelled_pending'].includes(order.status)
                                        ? 'Accès expiré ou résilié.'
                                        : 'Accès indisponible. Contactez le support.'
                                  )}
                                </div>
                              </div>

                              {/* Carte bancaire enregistrée */}
                              {order.stripeManaged && order.cardLast4 ? (() => {
                                const now = new Date();
                                const expired = order.cardExpYear && order.cardExpMonth && (
                                  order.cardExpYear < now.getFullYear() ||
                                  (order.cardExpYear === now.getFullYear() && order.cardExpMonth < now.getMonth() + 1)
                                );
                                const expiringSoon = order.cardExpYear && order.cardExpMonth && !expired && (
                                  (order.cardExpYear - now.getFullYear()) * 12 + (order.cardExpMonth - now.getMonth() - 1) <= 1
                                );
                                return (
                                  <div className={`card-banner ${expired ? 'danger' : expiringSoon ? 'warn' : 'info'}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                      <div style={{ fontSize: '0.82rem' }}>
                                        💳 <strong style={{ textTransform: 'capitalize' }}>{order.cardBrand || 'Carte'}</strong> •••• {order.cardLast4} <span style={{ color: 'var(--text-muted)' }}>· expire {String(order.cardExpMonth).padStart(2, '0')}/{order.cardExpYear}</span>
                                        {expired && <span className="card-badge danger">⚠️ EXPIRÉE</span>}
                                        {expiringSoon && <span className="card-badge warn">⏱️ Expire bientôt</span>}
                                      </div>
                                      {order.nextBillingAt && !expired && (
                                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                          Prochain prélèvement : {new Date(order.nextBillingAt).toLocaleDateString('fr-FR')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })() : !order.stripeManaged && order.status === 'active' && (
                                <div className="card-banner migrate">
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
                                {order.details && <button
                                  type="button"
                                  onClick={() => { void copyOrderDetails(order.id, order.details); }}
                                  className="btn btn-ghost btn-sm"
                                >{copiedOrderId === order.id ? '✅ Copié' : '📋 Copier les accès'}</button>}
                                {order.stripeManaged && (
                                  <button
                                    onClick={openBillingPortal}
                                    disabled={portalLoading}
                                    className="btn btn-ghost btn-sm"
                                  >{portalLoading ? '⏳' : '💳'} Gérer ma carte</button>
                                )}
                                {order.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={(e) => { cancelTriggerRef.current = e.currentTarget; setCancelOrderId(order.id); setCancelError(''); }}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--accent-red)', borderColor: '#efc4cc' }}
                                  >🔴 Résilier</button>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}

                        {/* Modal confirmation résiliation */}
                        <dialog
                          ref={cancelDialogRef}
                          className="client-dialog"
                          aria-labelledby="cancel-modal-title"
                          onCancel={(e) => {
                            e.preventDefault();
                            setCancelOrderId(null);
                            setCancelError('');
                            cancelTriggerRef.current?.focus();
                          }}
                          onClick={(e) => {
                            if (e.target === cancelDialogRef.current) {
                              setCancelOrderId(null);
                              setCancelError('');
                              cancelTriggerRef.current?.focus();
                            }
                          }}
                        >
                          {cancelOrderId && (() => {
                            const order = orders.find(o => o.id === cancelOrderId);
                            if (!order) return null;
                            const effectiveAt = order.cancellationEffectiveAt || order.nextBillingAt;
                            return (
                              <div className="client-dialog-body">
                                <h3 id="cancel-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 8 }}>🔴 Résilier mon abonnement</h3>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: 1.7, marginBottom: 12 }}>
                                  Vous êtes sur le point de résilier votre abonnement <strong style={{ color: 'var(--text-white)' }}>{order.service.name}</strong>.
                                </p>
                                <div className="card-banner danger" style={{ marginBottom: 16, lineHeight: 1.7 }}>
                                  Votre accès reste actif jusqu’à la fin de la période payée{effectiveAt && Number.isFinite(Date.parse(effectiveAt)) ? <> : <strong>{new Date(effectiveAt).toLocaleDateString('fr-FR')}</strong></> : '. La date effective sera précisée après confirmation'}. Aucun nouveau prélèvement ne doit intervenir après la date de résiliation confirmée.
                                </div>
                                {cancelError && (
                                  <div className="msg-error" role="alert" style={{ marginBottom: 12 }}>
                                    {cancelError}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <button
                                    type="button"
                                    onClick={doCancelOrder}
                                    disabled={cancellingOrder}
                                    className="btn client-danger-btn"
                                    style={{ flex: 1 }}
                                  >
                                    {cancellingOrder ? 'Traitement…' : 'Confirmer la résiliation'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setCancelOrderId(null); setCancelError(''); cancelTriggerRef.current?.focus(); }}
                                    className="btn btn-ghost"
                                    style={{ flex: 1 }}
                                    autoFocus
                                  >Annuler</button>
                                </div>
                              </div>
                            );
                          })()}
                        </dialog>
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
                        <label htmlFor="change-email-new" className="form-label">Nouvelle adresse e-mail</label>
                        <input
                          id="change-email-new"
                          type="email"
                          placeholder="nouvelle@exemple.com"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          className="dash-input"
                          autoComplete="email"
                          required
                        />
                        <label htmlFor="change-email-pwd" className="form-label">Mot de passe actuel (pour confirmer)</label>
                        <input
                          id="change-email-pwd"
                          type="password"
                          placeholder="Votre mot de passe actuel"
                          value={emailChangePwd}
                          onChange={e => setEmailChangePwd(e.target.value)}
                          className="dash-input"
                          autoComplete="current-password"
                          required
                        />
                        {changeEmailError && <div className="msg-error" role="alert">{changeEmailError}</div>}
                        {changeEmailMsg && <div className="msg-success" role="status">{changeEmailMsg}</div>}
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
                        <label htmlFor="change-pwd-current" className="form-label">Mot de passe actuel</label>
                        <input
                          id="change-pwd-current"
                          type="password"
                          placeholder="Votre mot de passe actuel"
                          value={currentPwd}
                          onChange={e => setCurrentPwd(e.target.value)}
                          className="dash-input"
                          autoComplete="current-password"
                          required
                        />
                        <label htmlFor="change-pwd-new" className="form-label">Nouveau mot de passe</label>
                        <input
                          id="change-pwd-new"
                          type="password"
                          placeholder="8 caractères minimum, lettre + chiffre"
                          value={newPwd}
                          onChange={e => setNewPwd(e.target.value)}
                          className="dash-input"
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                        {changePwdError && <div className="msg-error" role="alert">{changePwdError}</div>}
                        {changePwdMsg && <div className="msg-success" role="status">{changePwdMsg}</div>}
                        <button type="submit" disabled={changePwdBusy} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                          {changePwdBusy ? 'Enregistrement…' : 'Modifier le mot de passe'}
                        </button>
                      </form>
                    </div>

                    <div className="danger-zone">
                      <div className="danger-zone-title">
                        ⚠️ Zone dangereuse — Supprimer mon compte
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-soft)', lineHeight: 1.6, marginBottom: 8 }}>
                        Cette action est <strong style={{ color: 'var(--accent-red)' }}>définitive et irréversible</strong>. Votre profil de connexion et votre mot de passe seront supprimés. Certaines données liées aux commandes, aux factures et au support, dont votre adresse e-mail, restent conservées selon les durées indiquées dans notre <a href="/politique-confidentialite">politique de confidentialité</a>.
                      </p>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                        Vos abonnements actifs ne seront <strong>pas annulés</strong> — ils restent gérés via votre adresse email. En revanche, vous perdrez l&apos;accès à votre Espace Client et à l&apos;historique de vos conversations support.
                      </p>

                      <label htmlFor="delete-confirm" className="form-label">
                        Pour confirmer, tapez <code className="danger-code">supprimer</code> ci-dessous :
                      </label>
                      <input
                        id="delete-confirm"
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
                        placeholder="Tapez supprimer"
                        className="dash-input"
                        style={{ marginBottom: 12, borderColor: deleteConfirm.trim().toLowerCase() === 'supprimer' ? 'var(--accent-red)' : undefined }}
                        disabled={deleting}
                      />

                      <label htmlFor="delete-password" className="form-label">Mot de passe actuel</label>
                      <input
                        id="delete-password"
                        type="password"
                        value={deletePassword}
                        onChange={e => setDeletePassword(e.target.value)}
                        autoComplete="current-password"
                        maxLength={128}
                        className="dash-input"
                        style={{ marginBottom: 12 }}
                        disabled={deleting}
                        required
                      />

                      {deleteError && (
                        <div className="msg-error" role="alert" style={{ marginBottom: 12 }}>{deleteError}</div>
                      )}

                      {(() => {
                        const canDelete = deleteConfirm.trim().toLowerCase() === 'supprimer' && Boolean(deletePassword) && !deleting;
                        return (
                          <button
                            type="button"
                            onClick={doDeleteAccount}
                            disabled={!canDelete}
                            className="btn client-danger-btn"
                          >
                            {deleting ? 'Suppression en cours…' : '🗑️ Supprimer définitivement mon compte'}
                          </button>
                        );
                      })()}
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
