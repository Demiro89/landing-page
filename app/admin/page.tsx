'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SERVICE_CATALOG, CATALOG_CATEGORIES, type ServicePreset } from '@/lib/serviceCatalog';
import { Menu, X, LogOut, Keyboard, ArrowLeft, LayoutDashboard, ClipboardCheck, Package, Clapperboard, Users, Ticket, CircleAlert, Ban, MessagesSquare, Settings2, History, ShieldCheck, RefreshCw, ArrowUpRight, Download, Pencil, Save, Trash2, Check, Send, ChevronDown, Plus } from 'lucide-react';
import OperationsPanel, { type OperationsTab } from '@/components/admin/OperationsPanel';
import AdminActivityChart from '@/components/admin/AdminActivityChart';
import OrderStatus from '@/components/admin/OrderStatus';
import AdminDialog from '@/components/admin/AdminDialog';
import StockCredentials from '@/components/admin/StockCredentials';
import { readStockCredentials } from '@/lib/adminCredentials';
import { useAdminActions } from '@/components/admin/useAdminActions';
import { adminResponse } from '@/lib/adminResponse';
import { hasValidatedInitialAmount, isStripeOrder, matchesOrderSearch } from '@/lib/adminPresentation';
import { formatEuro } from '@/lib/offerPresentation';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Service {
  id: string; name: string; tagline: string; price: number; original: number;
  maxSlots: number; active: boolean; icon: string; gradient: string; features: string[];
  stocks: StockAccount[];
}
interface StockAccount {
  id: string; serviceId: string; accountsBoughtPrice: number; price: number;
  maxSlots: number; filledSlots: number; details: string; createdAt: string; updatedAt: string;
}
interface Order {
  id: string; date: string; price: number; fee: number; total: number;
  clientEmail: string; youtubeEmail?: string | null; status: string; details: string;
  serviceId: string;
  stockAccountId: string;
  paymentMethod?: string | null;
  stripeSubscriptionId?: string | null;
  acceptanceIp?: string | null;
  acceptanceUserAgent?: string | null;
  acceptedTermsAt?: string | null;
  acceptedWithdrawalWaiverAt?: string | null;
  acceptedEligibilityAt?: string | null;
  termsVersion?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationEffectiveAt?: string | null;
  unpaidSince?: string | null;
  reminderCount?: number;
  lastReminderAt?: string | null;
  nextBillingAt?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  service: { name: string; icon: string; gradient?: string };
  stockAccount: { accountsBoughtPrice: number; maxSlots: number };
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

type AdminPage = 'dashboard' | 'pending' | 'stocks' | 'services' | 'subscribers' | 'clients' | 'unpaid' | 'cancellations' | 'support' | 'settings' | 'audit' | 'operations';

// Ordre stable des pages pour les raccourcis clavier (touches 1-9 puis 0).
const ADMIN_PAGE_ORDER: AdminPage[] = ['dashboard', 'pending', 'stocks', 'services', 'subscribers', 'clients', 'unpaid', 'cancellations', 'support', 'settings', 'audit'];
type AccentStyle = React.CSSProperties & { '--accent-color': string };
type StockWithService = StockAccount & { serviceName: string; serviceIcon: string; serviceGradient: string };
interface ServiceForm {
  id: string; name: string; icon: string; gradient: string; price: string; original: string;
  tagline: string; maxSlots: string; features: string;
}
type ServiceFormKey = keyof ServiceForm;

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt = formatEuro;

const accentStyle = (value: string): AccentStyle => ({ '--accent-color': value });
const serviceFields: Array<{ label: string; key: ServiceFormKey; placeholder: string; type?: string }> = [
  { label: 'Identifiant (minuscules)', key: 'id', placeholder: 'netflix' },
  { label: 'Nom du service', key: 'name', placeholder: 'Netflix Premium' },
  { label: 'Icône / Emoji', key: 'icon', placeholder: '🍿' },
  { label: 'Prix location (€)', key: 'price', placeholder: '4.99', type: 'number' },
  { label: 'Tarif public (€)', key: 'original', placeholder: '19.99', type: 'number' },
  { label: 'Phrase d\'accroche', key: 'tagline', placeholder: 'Séries et films Ultra HD' },
  { label: 'Places max', key: 'maxSlots', placeholder: '4', type: 'number' },
];

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function AdminPage() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<AdminPage>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const toast = useCallback((message: string) => setNotification(message), []);
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(''), 6500);
    return () => clearTimeout(timer);
  }, [notification]);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [orderFilter, setOrderFilter] = useState('all');
  const [supportError, setSupportError] = useState('');
  const [auditError, setAuditError] = useState('');
  const mainRef = React.useRef<HTMLElement>(null);

  // Double authentification (2FA / TOTP)
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // Chiffrement des données héritées
  const [encryptBusy, setEncryptBusy] = useState(false);
  const [encryptResult, setEncryptResult] = useState('');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [clientsSearch, setClientsSearch] = useState('');
  const [ordersPage, setOrdersPage] = useState(0);
  const [kpiRange, setKpiRange] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [loadError, setLoadError] = useState('');
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState<Kpis>({ totalRevenue: 0, totalCogs: 0, totalInvestment: 0, netProfit: 0, marginPercentage: 0 });
  const [clients, setClients] = useState<Client[]>([]);
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; entityType: string; entityId: string | null; description: string; ip: string | null; createdAt: string }[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    crypto_btc: '', crypto_eth: '', crypto_usdt: '', crypto_ltc: '',
    gateway_cb: 'true', gateway_paypal: 'true', gateway_crypto: 'true',
    paypal_email: '',
  });

  const [stockForm, setStockForm] = useState({ serviceId: '', accountsBoughtPrice: '', price: '', maxSlots: '', details: '' });
  const [editStock, setEditStock] = useState<StockAccount | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [srvForm, setSrvForm] = useState<ServiceForm>({ id: '', name: '', icon: '', gradient: '', price: '', original: '', tagline: '', maxSlots: '', features: '' });
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

  const { request: adminFetch, busy: mutationBusy } = useAdminActions(loading, loadError, setLoadError, toast);

  const [operationsTab, setOperationsTab] = useState<OperationsTab>('Offres');
  const navigate = (page: AdminPage, tab: OperationsTab = 'Offres') => {
    setOperationsTab(tab);
    setActivePage(page); setMobileNavOpen(false);
    mainRef.current?.focus();
    window.scrollTo({ top: 0 });
  };

  /* ─── Auth ───────────────────────────────────────────────────────────── */
  const doLogout = async () => {
    if (!confirm('Confirmer la déconnexion ?')) return;
    try {
      const response = await adminFetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      if (!response.ok) { toast('Déconnexion impossible. Réessayez.'); return; }
      router.replace('/admin/login');
      router.refresh();
    } catch { toast('Connexion au serveur impossible. Réessayez.'); }
  };

  /* ─── Data ────────────────────────────────────────────────────────────── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, clientRes, settRes, twoFaRes] = await Promise.all(
        ['stock', 'clients', 'settings', '2fa'].map(async path => {
          const response = await adminResponse(`/api/admin/${path}`);
          if (response.status === 401) router.replace('/admin/login');
          if (!response.ok) throw new Error('Chargement impossible');
          const data = await response.json();
          if (!data.success) throw new Error('Réponse invalide');
          return data;
        }),
      );
      setServices(stockRes.services); setOrders(stockRes.orders); setKpis(stockRes.kpis);
      setSchemaEnabled(stockRes.schemaEnabled === true);
      setClients(clientRes.clients);
      setSettings(settRes.settings);
      setTwoFaEnabled(twoFaRes.enabled);
      setLoadError('');
      setLastLoadedAt(new Date());
      return true;
    } catch { setLoadError('Chargement impossible. Les données affichées peuvent être anciennes. Réessayez avant toute modification.'); return false; }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void Promise.resolve().then(loadAll); }, [loadAll]);

  /* ─── Raccourcis clavier ──────────────────────────────────────────────── */
  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      return node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      // Échap : ferme l'aide et tout modal ouvert.
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setShowShortcuts(false);
        setEditStock(null);
        setEditOrder(null);
        setCatalogOpen(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      // ? : affiche/masque l'aide des raccourcis.
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(s => !s); return; }
      // / : place le focus sur la recherche visible.
      if (e.key === '/') {
        const input = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (input) { e.preventDefault(); input.focus(); }
        return;
      }
      // 1-9 puis 0 : navigation directe entre les pages.
      if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
        const page = ADMIN_PAGE_ORDER[idx];
        if (page) { e.preventDefault(); setActivePage(page); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ─── 2FA (TOTP) ──────────────────────────────────────────────────────── */
  const start2faSetup = async () => {
    setTwoFaBusy(true);
    try {
      const r = await adminFetch('/api/admin/2fa', {
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
      const r = await adminFetch('/api/admin/2fa', {
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
      const r = await adminFetch('/api/admin/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', token: twoFaCode }),
      });
      const d = await r.json();
      if (d.success) { setTwoFaEnabled(false); setTwoFaCode(''); toast('Double authentification désactivée'); }
      else toast(d.error || 'Code incorrect');
    } finally { setTwoFaBusy(false); }
  };

  /* ─── Chiffrement des identifiants hérités ────────────────────────────── */
  const runLegacyEncryption = async () => {
    if (!confirm('Une sauvegarde vérifiée est nécessaire. Confirmez-vous qu’elle est disponible avant de chiffrer les anciennes données ?')) return;
    setEncryptBusy(true);
    try {
      const r = await adminFetch('/api/admin/encrypt-legacy', { method: 'POST' });
      const d = await r.json();
      if (d.success) {
        setEncryptResult(`${d.stocksDone} compte(s) de stock et ${d.ordersDone} commande(s) chiffré(s).`);
        toast('Chiffrement terminé !');
      } else {
        toast(d.error || 'Erreur');
      }
    } catch {
      toast('Erreur réseau');
    } finally {
      setEncryptBusy(false);
    }
  };

  /* ─── Validation des commandes manuelles (PayPal / crypto) ────────────── */
  const validateOrder = async (orderId: string) => {
    if (busyOrderId) return;
    const paymentReference = schemaEnabled ? prompt('Référence du paiement dont la réception a été vérifiée chez PayPal ou sur le réseau concerné :') : '';
    if (schemaEnabled && !paymentReference) return;
    if (!confirm('Le paiement reçu a-t-il été vérifié ? La transmission de l’accès sera suivie après validation.')) return;
    setBusyOrderId(orderId);
    try {
      const r = await adminFetch('/api/admin/stock', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate_order', orderId, paymentReference }),
      });
      const d = await r.json();
      if (d.success) { toast(d.deliveryQueued ? 'Paiement validé ; transmission à suivre dans Vérifications et suivi.' : 'Commande validée ; vérifiez la transmission de l’accès.'); loadAll(); }
      else toast(d.error || 'Erreur');
    } catch { toast('Connexion impossible. Rechargez avant de réessayer.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const rejectOrder = async (orderId: string) => {
    if (busyOrderId) return;
    if (!confirm('Refuser cette commande en attente ?')) return;
    setBusyOrderId(orderId);
    try {
      const r = await adminFetch('/api/admin/stock', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject_order', orderId }),
      });
      const d = await r.json();
      if (d.success) { toast('Commande refusée'); loadAll(); }
      else toast(d.error || 'Erreur');
    } finally {
      setBusyOrderId(null);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  // Exécute une action en série sur plusieurs commandes (évite les races DB côté serveur).
  const runBulkOrders = async (action: 'validate_order' | 'reject_order', ids: string[]) => {
    let ok = 0, fail = 0;
    for (const orderId of ids) {
      try {
        const r = await adminFetch('/api/admin/stock', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, orderId }),
        });
        const d = await r.json();
        if (d.success) ok++; else fail++;
        if (r.status >= 500) { fail += ids.length - ok - fail; break; }
      } catch { fail++; }
    }
    return { ok, fail };
  };

  const validateSelected = async (ids: string[]) => {
    if (bulkBusy || ids.length === 0) return;
    if (!confirm(`Confirmez-vous avoir vérifié les paiements de ces ${ids.length} commandes ? La validation ne prouve pas la réception des accès.`)) return;
    setBulkBusy(true);
    try {
      const { ok, fail } = await runBulkOrders('validate_order', ids);
      toast(fail ? `${ok} validée(s), ${fail} en échec. Vérifiez le suivi.` : `${ok} commande(s) validée(s). Vérifiez la transmission des accès.`);
      setSelectedOrders(new Set());
      loadAll();
    } finally {
      setBulkBusy(false);
    }
  };

  const rejectSelected = async (ids: string[]) => {
    if (bulkBusy || ids.length === 0) return;
    if (!confirm(`Refuser ${ids.length} commande(s) en attente ?`)) return;
    setBulkBusy(true);
    try {
      const { ok, fail } = await runBulkOrders('reject_order', ids);
      toast(fail ? `${ok} refusée(s), ${fail} en échec` : `${ok} commande(s) refusée(s)`);
      setSelectedOrders(new Set());
      loadAll();
    } finally {
      setBulkBusy(false);
    }
  };

  const loadSupportThreads = useCallback(async () => {
    const r = await adminResponse('/api/chat');
    const d = await r.json();
    if (r.ok && d.success) { setSupportThreads(d.threads); setSupportError(''); }
    else setSupportError(d.error || 'Conversations indisponibles.');
  }, []);

  React.useEffect(() => {
    if (activePage === 'support') {
      void Promise.resolve().then(loadSupportThreads);
      supportPollRef.current = setInterval(loadSupportThreads, 5000);
    } else {
      if (supportPollRef.current) clearInterval(supportPollRef.current);
    }
    return () => { if (supportPollRef.current) clearInterval(supportPollRef.current); };
  }, [activePage, loadSupportThreads]);

  React.useEffect(() => {
    supportBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSupportThread, supportThreads]);

  React.useEffect(() => {
    if (activePage === 'audit' && !auditLoaded) {
      adminResponse('/api/admin/audit?limit=200')
        .then(r => r.json())
        .then(d => { if (d.success) { setAuditLogs(d.logs); setAuditLoaded(true); setAuditError(''); } else setAuditError(d.error || 'Journal indisponible.'); });
    }
  }, [activePage, auditLoaded]);

  const sendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportInput.trim() || !activeSupportThread || sendingSupport) return;
    setSendingSupport(true);
    const text = supportInput.trim();
    try {
    const response = await adminFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: activeSupportThread, text, sender: 'Support StreamMalin' }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) { setSupportError(data.error || 'Réponse non enregistrée.'); return; }
    setSupportInput('');
    await loadSupportThreads();
    } finally { setSendingSupport(false); }
  };

  /* ─── KPIs filtrés par plage de dates ──────────────────────────────────── */
  const filteredKpis = (() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (kpiRange === 'month') cutoff.setMonth(now.getMonth() - 1);
    else if (kpiRange === 'quarter') cutoff.setMonth(now.getMonth() - 3);
    else if (kpiRange === 'year') cutoff.setFullYear(now.getFullYear() - 1);

    const paidOrders = orders.filter(order => hasValidatedInitialAmount(order.status));
    const subset = kpiRange === 'all' ? paidOrders : paidOrders.filter((o: Order) => new Date(o.date) >= cutoff);
    const totalRevenue = subset.reduce((s: number, o: Order) => s + o.total, 0);
    const totalCogs = subset.reduce((s: number, o: Order) => s + (o.stockAccount?.maxSlots > 0 ? o.stockAccount.accountsBoughtPrice / o.stockAccount.maxSlots : 0), 0);
    const netProfit = totalRevenue - totalCogs;
    const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCogs: parseFloat(totalCogs.toFixed(2)),
      totalInvestment: kpis.totalInvestment,
      netProfit: parseFloat(netProfit.toFixed(2)),
      marginPercentage: parseFloat(marginPercentage.toFixed(2)),
    };
  })();

  /* ─── Chart ───────────────────────────────────────────────────────────── */
  const chartData = (() => {
    const days: { label: string; profit: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      const dayOrders = orders.filter(o => new Date(o.date).toDateString() === d.toDateString());
      const profit = dayOrders.filter(order => hasValidatedInitialAmount(order.status)).reduce((acc, o) => acc + o.total - (o.stockAccount?.maxSlots > 0 ? o.stockAccount.accountsBoughtPrice / o.stockAccount.maxSlots : 0), 0);
      days.push({ label: label.charAt(0).toUpperCase() + label.slice(1), profit });
    }
    return days;
  })();

  /* ─── Actions stock ───────────────────────────────────────────────────── */
  const addStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await adminFetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'add_stock', serviceId: stockForm.serviceId, accountsBoughtPrice: stockForm.accountsBoughtPrice || '0', price: stockForm.price, maxSlots: stockForm.maxSlots, filledSlots: 0, details: stockForm.details }),
    });
    const d = await r.json();
    if (d.success) { toast('Compte de stock ajouté !'); setStockForm({ serviceId: '', accountsBoughtPrice: '', price: '', maxSlots: '', details: '' }); loadAll(); }
    else toast('Erreur : ' + d.error);
  };

  const addStockInline = async (serviceId: string, price: string, maxSlots: string, details: string): Promise<boolean> => {
    const r = await adminFetch('/api/admin/stock', {
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
    const r = await adminFetch('/api/admin/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_stock', id: editStock.id, expectedUpdatedAt: editStock.updatedAt, accountsBoughtPrice: editStock.accountsBoughtPrice, price: editStock.price, maxSlots: editStock.maxSlots, filledSlots: editStock.filledSlots, details: editStock.details }),
    });
    const d = await r.json();
    if (d.success) { toast('Compte de stock mis à jour !'); setEditStock(null); loadAll(); }
    else toast('Erreur : ' + d.error);
  };

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    const r = await adminFetch('/api/admin/stock', {
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
    const response = await adminFetch(`/api/admin/stock?id=${encodeURIComponent(id)}&type=stock`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok || !data.success) { toast(data.error || 'Suppression refusée.'); return; }
    toast('Stock supprimé.');
    loadAll();
  };

  /* ─── Actions services ────────────────────────────────────────────────── */
  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = srvForm.features.split(',').map(f => f.trim()).filter(Boolean);
    const r = await adminFetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_service', id: srvForm.id, name: srvForm.name, icon: srvForm.icon, gradient: srvForm.gradient || 'linear-gradient(135deg, #a855f7, #3b82f6)', price: srvForm.price, original: srvForm.original, tagline: srvForm.tagline, maxSlots: srvForm.maxSlots, features }),
    });
    const d = await r.json();
    if (d.success) { toast('Fiche service enregistrée.'); setSrvForm({ id: '', name: '', icon: '', gradient: '', price: '', original: '', tagline: '', maxSlots: '', features: '' }); loadAll(); }
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
      const r = await adminFetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_service', id, name: p.name, icon: p.icon, gradient: p.gradient, price: p.price, original: p.original, tagline: p.tagline, maxSlots: p.maxSlots, features: p.features }),
      });
      const d = await r.json();
      if (d.success) { toast(`Fiche « ${p.name} » enregistrée.`); loadAll(); }
      else toast('Erreur : ' + d.error);
    } finally {
      setCatalogBusy(null);
    }
  };

  const saveService = async (svc: Service) => {
    const r = await adminFetch('/api/admin/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_service', id: svc.id, name: svc.name, icon: svc.icon, gradient: svc.gradient, price: svc.price, original: svc.original, tagline: svc.tagline, maxSlots: svc.maxSlots, features: svc.features }),
    });
    const d = await r.json();
    if (d.success) { toast(`Fiche ${svc.name} enregistrée.`); return await loadAll(); }
    toast(d.error || 'Enregistrement refusé.'); return false;
  };

  const toggleService = async (id: string, active: boolean) => {
    const response = await adminFetch('/api/admin/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_service', id, active }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) { toast(data.error || 'Modification refusée.'); return false; }
    await loadAll(); return true;
  };

  const deleteService = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement le service « ${name} » ? Tous les stocks associés seront aussi perdus.`)) return;
    const r = await adminFetch(`/api/admin/stock?id=${encodeURIComponent(id)}&type=service`, { method: 'DELETE' });
    const d = await r.json();
    if (d.success) { toast('Service supprimé.'); loadAll(); }
    else toast('Erreur : ' + (d.error || 'suppression impossible'));
  };

  /* ─── Settings ────────────────────────────────────────────────────────── */
  const saveSettings = async () => {
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const r = await adminFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: updates }),
    });
    const d = await r.json();
    if (d.success) toast('Paramètres sauvegardés !');
    else toast('Erreur lors de la sauvegarde.');
  };

  const openStockEditor = async (stock: StockAccount) => {
    try {
      const credentials = await readStockCredentials(stock.id);
      if (credentials.updatedAt !== stock.updatedAt) {
        toast('Ce compte a changé. Les données vont être actualisées.');
        await loadAll();
        return;
      }
      setEditStock({ ...stock, details: credentials.details });
    } catch (error) { toast(error instanceof Error ? error.message : 'Consultation indisponible.'); }
  };
  const changeOrder = async (action: string, orderId: string, message: string, extra: Record<string, unknown> = {}) => {
    const response = await adminFetch('/api/admin/stock', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, orderId, ...extra }) });
    const data = await response.json();
    if (!data.success) { toast(data.error || 'Action refusée.'); return; }
    await loadAll(); toast(action === 'send_reminder' ? `Relance ${data.reminderLevel}/3 enregistrée` : message);
  };
  const markUnpaid = async (orderId: string) => {
    if (confirm('Signaler un impayé pour cette commande et enregistrer une relance ?')) await changeOrder('mark_unpaid', orderId, 'Commande marquée impayée, relance enregistrée');
  };
  const sendReminder = (orderId: string) => changeOrder('send_reminder', orderId, 'Relance enregistrée');
  const markPaid = async (orderId: string) => {
    const order = orders.find(item => item.id === orderId);
    if (!order || isStripeOrder(order)) return;
    const paymentReference = schemaEnabled ? prompt('Référence du nouveau paiement reçu et vérifié (jamais une référence déjà utilisée) :') : '';
    if (schemaEnabled && !paymentReference) return;
    if (!confirm(`Confirmez-vous avoir vérifié la réception de ${fmt(order.price)} pour cette échéance ? Ne confirmez pas un règlement partiel.`)) return;
    await changeOrder('mark_paid', orderId, 'Paiement manuel confirmé. Vérifiez son historique.', { paymentReference });
  };
  const cancelAfterUnpaid = async (orderId: string) => {
    if (confirm('Résilier cet abonnement pour impayé ? Le retrait fournisseur reste à vérifier.')) await changeOrder('cancel_order', orderId, 'Résiliation enregistrée. Vérifiez le retrait de l’accès fournisseur.');
  };
  const confirmCancel = async (orderId: string) => {
    if (confirm('Confirmer la résiliation immédiate ? Le retrait fournisseur reste à vérifier.')) await changeOrder('cancel_order', orderId, 'Résiliation enregistrée. Vérifiez le retrait de l’accès.');
  };

  /* ─── ADMIN UI ─────────────────────────────────────────────────────────── */
  const allStocks: StockWithService[] = services.flatMap(s => s.stocks.map(st => ({ ...st, serviceName: s.name, serviceIcon: s.icon, serviceGradient: s.gradient })));

  const pendingCount = orders.filter(o => o.status === 'pending' && !isStripeOrder(o)).length;
  const unpaidCount = orders.filter(o => o.status === 'unpaid').length;
  const reviewCount = orders.filter(o => o.status === 'payment_review').length;
  const cancellationCount = orders.filter(o => o.status === 'cancelled_pending').length;
  const availablePlaces = allStocks.reduce((count, stock) => count + Math.max(0, stock.maxSlots - stock.filledSlots), 0);
  const filteredOrders = orders.filter(order => matchesOrderSearch(order, ordersSearch) && (orderFilter === 'all' || order.status === orderFilter));
  const navIcons = { operations: ShieldCheck, dashboard: LayoutDashboard, pending: ClipboardCheck, stocks: Package, services: Clapperboard, subscribers: Ticket, clients: Users, unpaid: CircleAlert, cancellations: Ban, support: MessagesSquare, settings: Settings2, audit: History };

  const navItems: [AdminPage, string, string, number?][] = [
    ['dashboard', '📊', 'Tableau de bord'],
    ['pending', '🕓', 'À valider', pendingCount],
    ['unpaid', '⚠️', 'Impayés', unpaidCount],
    ['cancellations', '🔴', 'Résiliations', cancellationCount],
    ['operations', '', 'Vérifications et suivi', reviewCount],
    ['stocks', '📦', 'Stocks'],
    ['services', '🎬', 'Services & tarifs'],
    ['subscribers', '🎫', 'Abonnements'],
    ['clients', '👥', 'Clients'],
    ['support', '💬', 'Support'],
    ['audit', '🔍', 'Journal d’audit'],
    ['settings', '⚙️', 'Paramètres'],
  ];

  return (
    <div className="admin-page">
      <a className="admin-skip" href="#admin-content">Aller au contenu</a>
      <div className={`admin-notification${notification ? ' visible' : ''}`} role="status" aria-live="polite">{notification}</div>

      {/* Topbar */}
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">SM</div>
            <span>StreamMalin<small>Administration</small></span>
          </Link>
          <div className="admin-topbar-actions">
            <button type="button" className="admin-mobile-toggle" onClick={() => setMobileNavOpen(open => !open)} aria-label={mobileNavOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'} aria-expanded={mobileNavOpen} aria-controls="admin-mobile-navigation" title="Navigation">
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="admin-topbar-status"><ShieldCheck size={15} aria-hidden="true" /> Espace privé</span>
            <button type="button" onClick={loadAll} disabled={loading || mutationBusy} className="btn btn-ghost btn-sm admin-refresh" title="Actualiser les données" aria-label="Actualiser les données"><RefreshCw size={18} className={loading ? 'admin-spin' : ''} /></button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="btn btn-ghost btn-sm"
              aria-label="Afficher les raccourcis clavier"
              title="Raccourcis clavier (?)"
            >
              <Keyboard size={18} aria-hidden="true" />
            </button>
            <button onClick={doLogout} className="btn btn-danger btn-sm admin-logout" aria-label="Déconnexion" title="Déconnexion">
              <LogOut size={18} aria-hidden="true" /><span>Déconnexion</span>
            </button>
          </div>
        </div>
        {mobileNavOpen && <nav id="admin-mobile-navigation" className="admin-mobile-navigation" aria-label="Administration">
          {navItems.map(([page, , label, count]) => { const Icon = navIcons[page]; return <button key={page} type="button" onClick={() => navigate(page)} aria-current={activePage === page ? 'page' : undefined}>
            <Icon size={17} aria-hidden="true" /><span>{label}</span>{!!count && <span className="admin-nav-count">{count}</span>}
          </button>; })}
          <Link href="/"><ArrowLeft size={16} aria-hidden="true" /> Retour au site</Link>
        </nav>}
      </header>

      <div className="admin-shell">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <nav aria-label="Administration">
          {navItems.map(([page, , label, count], index) => { const Icon = navIcons[page]; return <React.Fragment key={page}>
            {[0, 5, 9].includes(index) && <div className="admin-sidebar-title">{index === 0 ? 'Pilotage' : index === 5 ? 'Catalogue & clients' : 'Administration'}</div>}
            <button
              onClick={() => navigate(page)}
              className={`dash-sidebar-btn ${activePage === page ? 'active' : ''}`}
              aria-current={activePage === page ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
              {!!count && (
                <span className="admin-nav-count" aria-label={`${count} en attente`}>
                  {count}
                </span>
              )}
            </button>
          </React.Fragment>; })}
          </nav>

          <div className="dash-sidebar-divider" />

          <a href="/" target="_blank" rel="noopener noreferrer" className="dash-sidebar-btn">
            <ArrowUpRight size={18} aria-hidden="true" /> Voir le site
          </a>

          <div className="dash-sidebar-foot" style={{ marginTop: 16 }}>
            <ShieldCheck size={16} aria-hidden="true" /> Accès administrateur
          </div>
        </aside>

        {/* Main */}
        <main id="admin-content" ref={mainRef} tabIndex={-1} className="admin-main">
          <div className="admin-context"><span>Administration <span aria-hidden="true">/</span> <strong>{navItems.find(([page]) => page === activePage)?.[2]}</strong></span><span>{loading ? 'Chargement…' : lastLoadedAt ? `Données actualisées à ${lastLoadedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Données indisponibles'}</span></div>
          {loadError && <div className="admin-load-error error-box" role="alert">{loadError}<button className="btn btn-ghost btn-sm" onClick={loadAll}>Réessayer</button></div>}
          {loading && !lastLoadedAt && <p className="admin-loading" role="status">Chargement du tableau de bord…</p>}
          <fieldset className="admin-workspace" disabled={loading || Boolean(loadError) || mutationBusy} aria-busy={loading || mutationBusy}>
          {activePage === 'operations' && <OperationsPanel key={operationsTab} initialTab={operationsTab} />}

          {/* ── DASHBOARD ── */}
          {activePage === 'dashboard' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div className="admin-eyebrow">Vue d’ensemble</div>
                  <h1>Tableau de bord</h1>
                  <p>Commandes, accès et points à traiter.</p>
                </div>
                <button onClick={loadAll} className="btn btn-ghost btn-sm" style={{ marginTop: 8, flexShrink: 0 }}>
                  <RefreshCw size={16} aria-hidden="true" /> Actualiser
                </button>
              </div>

              <div className="admin-priorities" aria-label="Actions prioritaires">
                {([{ page: 'pending', label: 'À valider', value: pendingCount, icon: ClipboardCheck }, { page: 'unpaid', label: 'Impayés', value: unpaidCount, icon: CircleAlert }, { page: 'operations', label: 'Paiements à vérifier', value: reviewCount, icon: ShieldCheck }, { page: 'stocks', label: 'Places non occupées', value: availablePlaces, icon: Package }] as const).map(item => <button key={item.page} type="button" onClick={() => navigate(item.page, item.page === 'operations' ? 'Transmissions' : 'Offres')}><item.icon size={19} aria-hidden="true" /><span>{item.label}<strong>{loading || loadError ? '—' : item.value}</strong></span><ArrowUpRight size={15} aria-hidden="true" /></button>)}
              </div>
              <div className="admin-metrics-toolbar"><h2>Indicateurs de commandes</h2>
              <div className="admin-periods" role="group" aria-label="Période des indicateurs">
                {(['all', 'month', 'quarter', 'year'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setKpiRange(r)}
                    aria-pressed={kpiRange === r}
                    className={`btn btn-sm ${kpiRange === r ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: '0.78rem' }}
                  >
                    {r === 'all' ? 'Tout' : r === 'month' ? '30 jours' : r === 'quarter' ? '3 mois' : '12 mois'}
                  </button>
                ))}
              </div>
              </div>
              <div className="kpi-grid fade-in-up-stagger">
                <div className="glass-panel kpi-card" style={accentStyle('linear-gradient(90deg, hsl(145,80%,48%), hsl(170,80%,50%))')}>
                  <div className="kpi-label">Montants initiaux validés</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{loading || loadError ? '—' : fmt(filteredKpis.totalRevenue)}</div>
                  <div className="kpi-sub">Hors attente, revue et annulations</div>
                </div>
                <div className="glass-panel kpi-card" style={accentStyle('linear-gradient(90deg, hsl(355,85%,58%), hsl(20,85%,58%))')}>
                  <div className="kpi-label">Achats de comptes</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>{loading || loadError ? '—' : fmt(filteredKpis.totalInvestment)}</div>
                  <div className="kpi-sub">Tous les comptes · toutes périodes</div>
                </div>
                <div className="glass-panel kpi-card" style={accentStyle('var(--gradient-aurora)')}>
                  <div className="kpi-label">Marge indicative</div>
                  <div className="kpi-value gradient-text">{loading || loadError ? '—' : fmt(filteredKpis.netProfit)}</div>
                  <div className="kpi-sub">Estimation · hors frais, taxes et remboursements</div>
                </div>
                <div className="glass-panel kpi-card" style={accentStyle('linear-gradient(90deg, hsl(42,100%,58%), hsl(36,100%,55%))')}>
                  <div className="kpi-label">Marge indicative (%)</div>
                  <div className="kpi-value" style={{ color: 'var(--accent-yellow)' }}>{loading || loadError ? '—' : `${filteredKpis.marginPercentage.toFixed(1).replace('.', ',')}%`}</div>
                  <div className="kpi-sub">Ne constitue pas un résultat comptable</div>
                </div>
              </div>

              {/* Recent orders */}
              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ClipboardCheck size={18} aria-hidden="true" />
                    Historique récent des commandes
                  </div>
                  <a href="/api/admin/export?type=orders" download className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
                    <Download size={15} aria-hidden="true" /> Exporter CSV
                  </a>
                </div>
                <div className="admin-orders-toolbar">
                  <input
                    type="search"
                    aria-label="Rechercher une commande par email, service ou ID"
                    placeholder="Rechercher par e-mail, service ou référence"
                    value={ordersSearch}
                    onChange={e => { setOrdersSearch(e.target.value); setOrdersPage(0); }}
                    className="dash-input"
                    style={{ maxWidth: 420 }}
                  />
                  <select className="dash-input" aria-label="Filtrer les commandes par statut" value={orderFilter} onChange={event => { setOrderFilter(event.target.value); setOrdersPage(0); }}><option value="all">Tous les statuts</option>{['pending', 'active', 'payment_review', 'unpaid', 'cancelled_pending', 'cancelled'].map(status => <option key={status} value={status}>{status === 'pending' ? 'En attente' : status === 'active' ? 'Actives' : status === 'payment_review' ? 'Paiements à vérifier' : status === 'unpaid' ? 'Impayées' : status === 'cancelled_pending' ? 'Résiliations programmées' : 'Résiliées / refusées'}</option>)}</select>
                  <span className="admin-result-count">{filteredOrders.length} commande(s)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Date</th>
                        <th scope="col">Service</th>
                        <th scope="col">Client</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Prix</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                        <th scope="col">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = filteredOrders;
                        if (filtered.length === 0) return (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>{loading ? 'Chargement…' : loadError ? 'Données indisponibles.' : ordersSearch || orderFilter !== 'all' ? 'Aucune commande ne correspond aux filtres.' : 'Aucune commande pour le moment.'}</td></tr>
                        );
                        return filtered.slice(ordersPage * 20, ordersPage * 20 + 20).map(o => (
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
                              <OrderStatus status={o.status} />
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const filtered = filteredOrders;
                  const totalPages = Math.ceil(filtered.length / 20);
                  if (totalPages <= 1) return null;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                      <button onClick={() => setOrdersPage(p => Math.max(0, p - 1))} disabled={ordersPage === 0} className="btn btn-ghost btn-sm">← Préc.</button>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Page {ordersPage + 1} / {totalPages}</span>
                      <button onClick={() => setOrdersPage(p => Math.min(totalPages - 1, p + 1))} disabled={ordersPage >= totalPages - 1} className="btn btn-ghost btn-sm">Suiv. →</button>
                    </div>
                  );
                })()}
              </div>
              {!loading && !loadError && <AdminActivityChart days={chartData} />}
            </div>
          )}

          {/* ── COMMANDES À VALIDER ── */}
          {activePage === 'pending' && (() => {
            const pending = orders.filter(o => o.status === 'pending' && !isStripeOrder(o));
            const selectedIds = pending.filter(o => selectedOrders.has(o.id)).map(o => o.id);
            const allSelected = pending.length > 0 && selectedIds.length === pending.length;
            const someSelected = selectedIds.length > 0 && !allSelected;
            const toggleAll = () => setSelectedOrders(allSelected ? new Set() : new Set(pending.map(o => o.id)));
            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <h2>Commandes à valider</h2>
                  <p>Paiements PayPal et crypto enregistrés, en attente de vérification.</p>
                </div>

                {pending.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">✅</div>
                    <p>Aucune commande en attente. Les paiements PayPal et crypto apparaîtront ici.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Barre d'actions groupées */}
                    <div className="bulk-bar" role="toolbar" aria-label="Actions groupées sur les commandes">
                      <label className="bulk-selectall">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected; }}
                          onChange={toggleAll}
                          aria-label="Tout sélectionner"
                          disabled={bulkBusy}
                        />
                        <span>{selectedIds.length > 0 ? `${selectedIds.length} sélectionnée(s)` : 'Tout sélectionner'}</span>
                      </label>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => validateSelected(selectedIds)}
                        disabled={schemaEnabled || bulkBusy || selectedIds.length === 0}
                        aria-busy={bulkBusy}
                        className="btn btn-primary btn-sm"
                      >
                        {bulkBusy ? 'Traitement…' : `✅ Valider la sélection${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
                      </button>
                      <button
                        onClick={() => rejectSelected(selectedIds)}
                        disabled={bulkBusy || selectedIds.length === 0}
                        aria-busy={bulkBusy}
                        className="btn btn-danger btn-sm"
                      >
                        ✕ Refuser la sélection{selectedIds.length ? ` (${selectedIds.length})` : ''}
                      </button>
                    </div>
                    {pending.map(o => (
                      <div key={o.id} className={`glass-panel admin-card fade-in-up${selectedOrders.has(o.id) ? ' admin-card-selected' : ''}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <input
                            type="checkbox"
                            checked={selectedOrders.has(o.id)}
                            onChange={() => toggleOrderSelection(o.id)}
                            aria-label={`Sélectionner la commande de ${o.clientEmail}`}
                            disabled={bulkBusy}
                            style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
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
                          {o.youtubeEmail ? ` · YouTube : ${o.youtubeEmail}` : ''}
                        </div>
                        {/* Preuves contractuelles */}
                        <details style={{ marginTop: 10 }}>
                          <summary style={{ fontSize: '0.72rem', color: 'var(--primary)', cursor: 'pointer', userSelect: 'none', fontWeight: 700 }}>🔏 Preuves contractuelles</summary>
                          <div style={{ marginTop: 8, fontSize: '0.71rem', fontFamily: "'SF Mono',Menlo,monospace", lineHeight: 2, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                            <div><strong>Réf. commande :</strong> {o.id}</div>
                            <div><strong>Email client :</strong> {o.clientEmail}</div>
                            <div><strong>Montant :</strong> {o.total.toFixed(2)}€</div>
                            <div><strong>Moyen de paiement :</strong> {o.paymentMethod || '—'}</div>
                            {o.termsVersion && <div><strong>Version CGV :</strong> {o.termsVersion}</div>}
                            {o.acceptedTermsAt && <div><strong>CGV acceptées le :</strong> {new Date(o.acceptedTermsAt).toLocaleString('fr-FR')}</div>}
                            {o.acceptedWithdrawalWaiverAt && <div><strong>Renonciation rétractation :</strong> {new Date(o.acceptedWithdrawalWaiverAt).toLocaleString('fr-FR')}</div>}
                            {o.acceptedEligibilityAt && <div><strong>Éligibilité confirmée le :</strong> {new Date(o.acceptedEligibilityAt).toLocaleString('fr-FR')}</div>}
                            {o.acceptanceIp && <div><strong>IP :</strong> {o.acceptanceIp}</div>}
                            {o.acceptanceUserAgent && <div><strong>User-Agent :</strong> {o.acceptanceUserAgent.slice(0, 80)}{o.acceptanceUserAgent.length > 80 ? '…' : ''}</div>}
                          </div>
                        </details>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => validateOrder(o.id)} disabled={busyOrderId === o.id || bulkBusy} aria-busy={busyOrderId === o.id} className="btn btn-primary btn-sm">
                            <Check size={15} aria-hidden="true" />{busyOrderId === o.id ? 'Traitement…' : 'Valider le paiement'}
                          </button>
                          <button onClick={() => rejectOrder(o.id)} disabled={busyOrderId === o.id || bulkBusy} aria-busy={busyOrderId === o.id} className="btn btn-danger btn-sm">
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
                <h2>Gestion des stocks</h2>
                <p>Comptes, capacité et accès associés aux offres.</p>
              </div>

              <details className="admin-card admin-create">
                <summary><Plus size={18} aria-hidden="true" /> Ajouter un compte de stock</summary>

                <form onSubmit={addStock}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="stock-service">Service <span className="required">*</span></label>
                      <select
                        id="stock-service"
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
                      <label className="form-label" htmlFor="stock-price">Prix location mensuel (€) <span className="required">*</span></label>
                      <input id="stock-price" type="number" step="0.01" min="0.01" required placeholder="3.49" value={stockForm.price}
                        onChange={e => setStockForm(f => ({ ...f, price: e.target.value }))}
                        className="dash-input" />
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="stock-slots">Capacité (places) <span className="required">*</span></label>
                      <input id="stock-slots" type="number" required min="1" placeholder="5" value={stockForm.maxSlots}
                        onChange={e => setStockForm(f => ({ ...f, maxSlots: e.target.value }))}
                        className="dash-input" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="stock-cost">Coût d&apos;achat (€)</label>
                    <input id="stock-cost" type="number" min="0" step="0.01" value={stockForm.accountsBoughtPrice} onChange={event => setStockForm(current => ({ ...current, accountsBoughtPrice: event.target.value }))} className="dash-input" />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="stock-details">Identifiants ou lien d&apos;invitation <span className="required">*</span></label>
                    <textarea
                      id="stock-details"
                      required
                      rows={3}
                      placeholder="email@example.com / motdepasse (Profil 3) OU Lien famille Google"
                      value={stockForm.details}
                      onChange={e => setStockForm(f => ({ ...f, details: e.target.value }))}
                      className="dash-input"
                      style={{ resize: 'vertical', minHeight: 80 }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary"><Plus size={16} aria-hidden="true" /> Ajouter au stock</button>
                </form>
              </details>

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
                      <div className="stock-icon-lg" style={{ background: st.serviceGradient }}>
                        {st.serviceIcon}
                      </div>
                      <div className="stock-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-white)' }}>{st.serviceName}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'SF Mono',Menlo,monospace" }}>#{st.id.slice(0, 8)}</span>
                          {st.filledSlots >= st.maxSlots && <span className="badge-pill warn">Complet</span>}
                        </div>
                        <div className="stock-info-row">
                          <span>Location : <strong>{fmt(st.price)}/mois</strong></span>
                          <span>·</span>
                          <span>Remplissage : <strong>{st.filledSlots}/{st.maxSlots}</strong></span>
                          {st.filledSlots < st.maxSlots && <><span>·</span><span style={{ color: 'var(--accent-green)' }}><strong>{st.maxSlots - st.filledSlots} slot{st.maxSlots - st.filledSlots > 1 ? 's' : ''} libre{st.maxSlots - st.filledSlots > 1 ? 's' : ''}</strong></span></>}
                        </div>
                        <StockCredentials stockId={st.id} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => void openStockEditor(st)} className="btn btn-ghost btn-sm"><Pencil size={15} aria-hidden="true" /> Modifier</button>
                        <button onClick={() => deleteStock(st.id)} className="btn btn-danger btn-sm"><Trash2 size={15} aria-hidden="true" /> Retirer</button>
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
                <h2>Services & tarifs</h2>
                <p>Créez, modifiez ou désactivez les services proposés sur la marketplace.</p>
              </div>

              <details className="admin-card admin-create">
                <summary><Plus size={18} aria-hidden="true" /> Créer un service</summary>
                <div className="admin-card-head">
                  <button
                    type="button"
                    onClick={() => { setCatalogOpen(true); setCatalogSearch(''); setCatalogCat('all'); }}
                    className="btn btn-primary btn-sm"
                    style={{ marginLeft: 'auto' }}
                  >
                    <Clapperboard size={16} aria-hidden="true" /> Catalogue ({SERVICE_CATALOG.length})
                  </button>
                </div>

                <form onSubmit={createService}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
                    {serviceFields.map(f => (
                      <div key={f.key} className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor={`service-${f.key}`}>{f.label} <span className="required">*</span></label>
                        <input
                          id={`service-${f.key}`}
                          type={f.type || 'text'}
                          step={f.type === 'number' ? '0.01' : undefined}
                          required
                          placeholder={f.placeholder}
                          value={srvForm[f.key]}
                          onChange={e => setSrvForm(form => ({ ...form, [f.key]: e.target.value }))}
                          className="dash-input"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="service-features">Fonctionnalités clés <span className="required">*</span></label>
                    <input
                      id="service-features"
                      type="text" required
                      placeholder="Ultra HD 4K, Profil dédié, Téléchargement hors-ligne"
                      value={srvForm.features}
                      onChange={e => setSrvForm(f => ({ ...f, features: e.target.value }))}
                      className="dash-input"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary"><Save size={16} aria-hidden="true" /> Enregistrer la fiche</button>
                </form>
              </details>

              <div className="glass-panel admin-card">
                <div className="admin-card-head">
                  <div className="icon-bubble">📚</div>
                  Catalogue actuel
                  <span className="badge-pill neutral" style={{ marginLeft: 'auto' }}>
                    {services.length} service{services.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="admin-card-sub">Ajustez les prix, descriptions et le statut d&apos;activation.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.map(svc => (
                    <ServiceEditCard key={svc.id} svc={svc} onSave={saveService} onToggle={toggleService} onDelete={deleteService} onEditStock={openStockEditor} onAddStock={addStockInline} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ABONNÉS PAR SERVICE & COMPTE ── */}
          {activePage === 'subscribers' && (() => {
            const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'unpaid' || o.status === 'cancelled_pending');

            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <h2>Abonnés par compte</h2>
                  <p>Vue regroupée par service puis par compte — qui est sur quel compte précis.</p>
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
                          <div key={stock.id} style={{ marginTop: idx === 0 ? 12 : 18, padding: '14px 0', borderTop: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-white)', background: '#eaf0ee', padding: '4px 10px', borderRadius: 4 }}>
                                  COMPTE #{idx + 1}
                                </span>
                                <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: "'SF Mono',Menlo,monospace" }}>{stock.id.slice(0, 8)}</code>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
                                  {stock.filledSlots}/{stock.maxSlots} slots occupés · {fmt(stock.price)}/mois
                                </span>
                              </div>
                              <StockCredentials stockId={stock.id} />
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
                                              aria-label={`Modifier les infos client : ${o.clientEmail}`}
                                            ><Pencil size={16} aria-hidden="true" /></button>
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
                                        <td><OrderStatus status={o.status} /></td>
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
                <h2>Clients</h2>
                <p>Profils dérivés des commandes. Montants initiaux, hors renouvellements et remboursements.</p>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="icon-bubble">💾</div>
                    Base de données clients
                    <span className="badge-pill neutral">
                      {clients.length} client{clients.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <a href="/api/admin/export?type=clients" download className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem', marginLeft: 'auto' }}>
                    Exporter CSV
                  </a>
                </div>

                {clients.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">👤</div>
                    <h3>Aucun client enregistré</h3>
                    <p>Les clients apparaîtront ici après leur première commande.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ marginBottom: 12 }}>
                      <input
                        type="search"
                        aria-label="Rechercher un client par e-mail"
                        placeholder="Rechercher par e-mail"
                        value={clientsSearch}
                        onChange={e => setClientsSearch(e.target.value)}
                        className="dash-input"
                        style={{ maxWidth: 360 }}
                      />
                    </div>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Email</th>
                          <th>1ère commande</th>
                          <th style={{ textAlign: 'center' }}>Commandes</th>
                          <th style={{ textAlign: 'center' }}>Actifs</th>
                          <th style={{ textAlign: 'right' }}>Montants initiaux validés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients
                          .filter(c => !clientsSearch || c.email.toLowerCase().includes(clientsSearch.toLowerCase()))
                          .map((c, i) => (
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
            const reminderLabels: Record<number, string> = { 0: 'Aucune relance', 1: 'Relance 1/3 enregistrée', 2: 'Relance 2/3 enregistrée', 3: 'Relance 3/3 enregistrée' };
            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <h2>Impayés</h2>
                  <p>Signalez un impayé, envoyez des rappels automatiques et résiliez si nécessaire.</p>
                </div>

                {/* Marquer une commande impayée */}
                <div className="glass-panel admin-card fade-in-up" style={{ marginBottom: 24 }}>
                  <div className="admin-card-head">
                    <div className="icon-bubble">🔍</div>
                    Signaler un impayé
                  </div>
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
                        const level = o.reminderCount || 0;
                        const daysSince = o.unpaidSince ? Math.floor((Date.now() - new Date(o.unpaidSince).getTime()) / 86400000) : 0;
                        return (
                          <div key={o.id} style={{ padding: '18px 0', borderTop: '1px solid var(--border-subtle)' }}>
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
                                    Dernière relance enregistrée : {new Date(o.lastReminderAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {isStripeOrder(o) ? <span className="admin-action-note">Régularisation à confirmer chez Stripe</span> : <button onClick={() => markPaid(o.id)} className="btn btn-ghost btn-sm"><Check size={15} aria-hidden="true" /> Confirmer le paiement</button>}
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
            return (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="admin-section-head fade-in-up">
                  <h2>Résiliations en attente</h2>
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
                <h2>Support client</h2>
                <p>Répondez aux messages de vos clients en temps réel.</p>
              </div>
              {supportError && <div className="error-box" role="alert">{supportError}<button type="button" className="btn btn-ghost btn-sm" onClick={loadSupportThreads}>Réessayer</button></div>}

              <div className="glass-panel fade-in-up" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {supportThreads.length === 0 ? (
                  <div className="dash-empty" style={{ borderRadius: 0 }}>
                    <div className="dash-empty-icon">💬</div>
                    <h3>{supportError ? 'Conversations indisponibles' : 'Aucune conversation'}</h3>
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
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Commande {thread.orderId.slice(0, 8)}</span>
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
                                aria-label="Réponse au client"
                                maxLength={2000}
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
                                <Send size={16} aria-hidden="true" /> Envoyer
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
                <h2>Paramètres globaux</h2>
                <p>Passerelles de paiement, portefeuilles crypto et options de plateforme.</p>
              </div>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">💳</div>
                  Moyens de paiement configurés
                </div>
                {[
                    { key: 'gateway_cb', label: 'Carte Bancaire', sub: 'Carte bancaire via Stripe', icon: '💳' },
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
                        onClick={async () => {
                          const newVal = on ? 'false' : 'true';
                          const response = await adminFetch('/api/admin/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ settings: [{ key: g.key, value: newVal }] }),
                          });
                          const data = await response.json();
                          if (!response.ok || !data.success) { toast(data.error || 'Modification refusée.'); return; }
                          setSettings(s => ({ ...s, [g.key]: newVal }));
                          toast(`${g.label} ${newVal === 'true' ? 'activé' : 'désactivé'}`);
                        }}
                        className={`toggle ${on ? 'on' : ''}`}
                        role="switch"
                        aria-checked={on}
                        aria-label={`Activer ${g.label}`}
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

              <details style={{ marginBottom: 0 }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, padding: '8px 4px', userSelect: 'none' }}>
                  ▸ Zone de maintenance (avancé)
                </summary>
                <div className="glass-panel admin-card fade-in-up" style={{ marginTop: 10 }}>
                  <div className="admin-card-head">
                    <div className="icon-bubble">🔒</div>
                    Chiffrement des données
                  </div>
                  <p className="admin-card-sub">
                    Chiffre les identifiants des comptes encore stockés en clair (anciennes données).
                    Les nouveaux ajouts sont déjà chiffrés automatiquement. Une sauvegarde vérifiée reste nécessaire avant une intervention sur les anciennes données.
                  </p>
                  {encryptResult && (
                    <div className="info-box" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                      <div className="info-box-title" style={{ color: 'var(--accent-green)' }}>✅ Chiffrement terminé</div>
                      <div className="info-box-text">{encryptResult}</div>
                    </div>
                  )}
                  <button
                    onClick={runLegacyEncryption}
                    disabled={encryptBusy}
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: encryptResult ? 12 : 0 }}
                  >
                    {encryptBusy ? '⏳ Chiffrement en cours…' : '🔒 Chiffrer les anciens identifiants'}
                  </button>
                </div>
              </details>

              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head">
                  <div className="icon-bubble">🅿️</div>
                  Adresse PayPal de réception
                </div>
                <p className="admin-card-sub">Email PayPal affiché aux clients lors du paiement PayPal.</p>
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="setting-paypal">Email PayPal</label>
                  <input
                    id="setting-paypal"
                    type="email"
                    placeholder="votre@paypal.com"
                    value={settings.paypal_email || ''}
                    onChange={e => setSettings(s => ({ ...s, paypal_email: e.target.value }))}
                    className="dash-input"
                  />
                </div>
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
                      <label className="form-label" htmlFor={`setting-${c.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.color, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', fontWeight: 700 }}>
                        <span style={{ fontSize: '1.2rem' }}>{c.symbol}</span> {c.label}
                      </label>
                      <input
                        id={`setting-${c.key}`}
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
                  <Save size={16} aria-hidden="true" /> Enregistrer les paramètres
                </button>
              </div>
            </div>
          )}

          {/* ── AUDIT ── */}
          {activePage === 'audit' && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="admin-section-head fade-in-up">
                <h2>Journal d&apos;audit</h2>
                <p>Historique des actions effectuées dans le panel admin — 200 dernières entrées.</p>
              </div>
              {auditError && <p className="error-box" role="alert">{auditError}</p>}
              <div className="glass-panel admin-card fade-in-up">
                <div className="admin-card-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="icon-bubble">🔍</div>
                    Activité administrative
                    <span className="badge-pill neutral">{auditLogs.length} entrée{auditLogs.length > 1 ? 's' : ''}</span>
                  </div>
                  <button onClick={() => { setAuditLoaded(false); }} className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
                    ↻ Actualiser
                  </button>
                </div>
                {auditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                    <p>{auditError ? 'Journal indisponible. Réessayez.' : !auditLoaded ? 'Chargement du journal…' : 'Aucune action enregistrée pour le moment.'}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: 8 }}>Les actions seront enregistrées dès la prochaine opération admin.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Action</th>
                          <th>Description</th>
                          <th>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(log => {
                          const actionColors: Record<string, string> = {
                            'order.validate': 'var(--accent-green)',
                            'order.reject': 'var(--accent-red)',
                            'order.cancel': 'var(--accent-red)',
                            'order.mark_unpaid': 'var(--accent-yellow)',
                            'order.mark_paid': 'var(--accent-green)',
                            'order.send_reminder': 'var(--accent-yellow)',
                            'service.upsert': 'var(--secondary)',
                            'service.toggle': 'var(--text-gray)',
                            'service.delete': 'var(--accent-red)',
                            'stock.create': 'var(--secondary)',
                            'stock.delete': 'var(--accent-red)',
                            'settings.update': 'var(--text-gray)',
                          };
                          const color = actionColors[log.action] || 'var(--text-muted)';
                          return (
                            <tr key={log.id}>
                              <td style={{ color: 'var(--text-gray)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td>
                                <span style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.75rem', color, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
                                  {log.action}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.85rem', color: 'var(--text-soft)' }}>{log.description}</td>
                              <td style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.ip || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </fieldset>
        {/* Native modal dialogs keep focus within the open form. */}
        {showShortcuts && (
          <AdminDialog title="Raccourcis clavier" onClose={() => setShowShortcuts(false)}>
            <div className="modal-content">
              <div className="admin-card-head" id="shortcuts-title">
                <div className="icon-bubble">⌨</div>
                Raccourcis clavier
              </div>
              <div className="shortcuts-list">
                {ADMIN_PAGE_ORDER.map((page, i) => {
                  const item = navItems.find(n => n[0] === page);
                  const keyLabel = i === 9 ? '0' : i < 9 ? String(i + 1) : '—';
                  return (
                    <div key={page} className="shortcut-row">
                      <kbd className="kbd">{keyLabel}</kbd>
                      <span>{item ? item[2] : page}</span>
                    </div>
                  );
                })}
                <div className="shortcut-row"><kbd className="kbd">/</kbd><span>Rechercher (focus)</span></div>
                <div className="shortcut-row"><kbd className="kbd">?</kbd><span>Afficher / masquer cette aide</span></div>
                <div className="shortcut-row"><kbd className="kbd">Échap</kbd><span>Fermer un volet ou cette aide</span></div>
              </div>
              <div style={{ marginTop: 18, textAlign: 'right' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowShortcuts(false)}>Fermer</button>
              </div>
            </div>
          </AdminDialog>
        )}

        {editStock && (
          <AdminDialog title="Modifier le compte en stock" onClose={() => setEditStock(null)}>
            <div className="modal-content">
              <div className="admin-card-head">
                <div className="icon-bubble">📝</div>
                Modifier le compte en stock
              </div>
              <form onSubmit={saveStock}>
                <fieldset className="admin-workspace" disabled={loading || !!loadError || mutationBusy}>
                <div className="info-box" style={{ marginBottom: 14 }}>
                  <div className="info-box-title">🔄 Mettre à jour les identifiants</div>
                  <div className="info-box-text">Retirez d’abord l’accès chez le fournisseur. Avec le suivi activé, confirmez ensuite la révocation dans Vérifications et suivi ; ne libérez pas la place manuellement.</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-stock-price">Prix location (€)</label>
                    <input id="edit-stock-price" type="number" min="0.01" step="0.01" required value={editStock.price}
                      onChange={e => setEditStock(s => s ? { ...s, price: +e.target.value } : s)}
                      className="dash-input" />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-stock-filled">Places occupées</label>
                    <input id="edit-stock-filled" type="number" required readOnly={schemaEnabled} min="0" value={editStock.filledSlots}
                      onChange={e => setEditStock(s => s ? { ...s, filledSlots: +e.target.value } : s)}
                      className="dash-input" />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="edit-stock-capacity">Places max</label>
                    <input id="edit-stock-capacity" type="number" required min="1" value={editStock.maxSlots}
                      onChange={e => setEditStock(s => s ? { ...s, maxSlots: +e.target.value } : s)}
                      className="dash-input" />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-stock-details">Identifiants ou lien d&apos;invitation</label>
                  <textarea id="edit-stock-details" rows={4} required value={editStock.details}
                    onChange={e => setEditStock(s => s ? { ...s, details: e.target.value } : s)}
                    className="dash-input"
                    placeholder="email@example.com / motdepasse (Profil 3)"
                    style={{ resize: 'vertical', minHeight: 100, fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.85rem' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={16} aria-hidden="true" /> Enregistrer</button>
                  <button type="button" onClick={() => setEditStock(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
                </div>
                </fieldset>
              </form>
            </div>
          </AdminDialog>
        )}

        {editOrder && (
          <AdminDialog title="Modifier les informations client" onClose={() => setEditOrder(null)}>
            <div className="modal-content">
              <div className="admin-card-head">
                <div className="icon-bubble">✏️</div>
                Modifier les infos client
              </div>
              <form onSubmit={saveOrder}>
                <fieldset className="admin-workspace" disabled={loading || !!loadError || mutationBusy}>
                <div className="info-box" style={{ marginBottom: 14 }}>
                  <div className="info-box-title">📝 Corriger les coordonnées</div>
                  <div className="info-box-text">
                    Si le client s&apos;est trompé d&apos;email ou d&apos;adresse YouTube, corrigez-les ici. Les futures notifications utiliseront les nouvelles valeurs.
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="edit-order-email">Adresse e-mail du client</label>
                  <input
                    id="edit-order-email"
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
                    <label className="form-label" htmlFor="edit-order-youtube">Adresse e-mail YouTube (Google)</label>
                    <input
                      id="edit-order-youtube"
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
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: '#f0f3f4', padding: '10px 12px', borderRadius: 5, marginBottom: 14 }}>
                  Commande : <code style={{ color: 'var(--text-gray)' }}>{editOrder.id.slice(0, 8)}</code> · Service : <strong style={{ color: 'var(--text-gray)' }}>{editOrder.service.name}</strong>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Save size={16} aria-hidden="true" /> Enregistrer</button>
                  <button type="button" onClick={() => setEditOrder(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
                </div>
                </fieldset>
              </form>
            </div>
          </AdminDialog>
        )}

        {catalogOpen && (() => {
          const q = catalogSearch.trim().toLowerCase();
          const filtered = SERVICE_CATALOG.filter(p =>
            (catalogCat === 'all' || p.category === catalogCat) &&
            (!q || p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q))
          );
          return (
            <AdminDialog title="Catalogue de modèles" onClose={() => setCatalogOpen(false)}>
              <div className="modal-content catalog-modal" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="admin-card-head">
                  <div className="icon-bubble">📚</div>
                  Catalogue de services
                </div>

                <input
                  type="text"
                  value={catalogSearch}
                  aria-label="Rechercher un modèle de service"
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="dash-input"
                  placeholder="🔍 Rechercher un service (Netflix, Spotify, VPN…)"
                  style={{ marginBottom: 12 }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => setCatalogCat('all')}
                    aria-pressed={catalogCat === 'all'}
                    className={`btn btn-sm ${catalogCat === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  >Tous</button>
                  {CATALOG_CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCatalogCat(c.id)}
                      aria-pressed={catalogCat === c.id}
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
                      <div key={p.id} style={{ background: '#f4f6f6', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                            disabled={!!catalogBusy || mutationBusy || loading || !!loadError}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                          ><Plus size={15} aria-hidden="true" /> {catalogBusy === p.id ? 'Enregistrement…' : (count > 0 ? 'Autre fiche' : 'Ajouter')}</button>
                          <button
                            type="button"
                            onClick={() => fillFromPreset(p)}
                            className="btn btn-ghost btn-sm"
                            title={`Pré-remplir le formulaire : ${p.name}`}
                            aria-label={`Pré-remplir le formulaire : ${p.name}`}
                          ><Pencil size={15} aria-hidden="true" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  ⚡ <strong>Ajouter</strong> publie le service immédiatement · ✏️ pré-remplit le formulaire pour ajuster les tarifs avant publication.
                </div>
              </div>
            </AdminDialog>
          );
        })()}
        </main>
      </div>
    </div>
  );
}

/* ─── ServiceEditCard (accordion) ───────────────────────────────────────── */
function ServiceEditCard({ svc, onSave, onToggle, onDelete, onEditStock, onAddStock }: {
  svc: Service;
  onSave: (svc: Service) => Promise<boolean>;
  onToggle: (id: string, active: boolean) => Promise<boolean>;
  onDelete: (id: string, name: string) => void;
  onEditStock: (st: StockAccount) => void;
  onAddStock: (serviceId: string, price: string, maxSlots: string, details: string) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState(svc);
  const [addPrice, setAddPrice] = useState('');
  const [addSlots, setAddSlots] = useState('');
  const [addDetails, setAddDetails] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => setLocal(svc));
  }, [svc]);

  const handleSaveAll = async () => {
    if (adding) return;
    setAdding(true);
    try {
    if ((addPrice || addSlots || addDetails) && !(addPrice && addSlots && addDetails)) return;
    if (!(await onSave(local))) return;
    if (addPrice && addSlots && addDetails) {
      const ok = await onAddStock(svc.id, addPrice, addSlots, addDetails);
      if (ok) { setAddPrice(''); setAddSlots(''); setAddDetails(''); }
    }
    } finally { setAdding(false); }
  };

  return (
    <div className="glass-panel svc-edit-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* ── Collapsed header (always visible) ── */}
      <button type="button" className="admin-service-summary" aria-expanded={expanded} aria-controls={`service-edit-${svc.id}`}
        onClick={() => setExpanded(x => !x)}
      >
        <span style={{ width: 32, height: 32, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', background: svc.gradient, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)', flexShrink: 0 }}>
          {svc.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--text-white)' }}>{svc.name}</strong>
          <span style={{ display: 'block', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 1 }}>
            {fmt(svc.price)}/mois · {svc.stocks?.length || 0} compte{(svc.stocks?.length || 0) > 1 ? 's' : ''} · {svc.stocks?.reduce((a, s) => a + s.filledSlots, 0) || 0}/{svc.stocks?.reduce((a, s) => a + s.maxSlots, 0) || 0} slots
          </span>
        </span>
        <span className="badge-pill" style={{ flexShrink: 0, background: local.active ? 'rgba(16,185,129,0.13)' : 'rgba(255,255,255,0.06)', color: local.active ? 'var(--accent-green)' : 'var(--text-muted)', border: `1px solid ${local.active ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
          {local.active ? '● Actif' : '○ Inactif'}
        </span>
        <ChevronDown size={18} style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : undefined }} aria-hidden="true" />
      </button>

      {/* ── Expanded form ── */}
      {expanded && (
        <div id={`service-edit-${svc.id}`} style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 16px 16px' }}>
          {/* Action buttons at top */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={handleSaveAll} disabled={adding} className="btn btn-primary btn-sm" style={{ flex: '1.6', minWidth: 0 }}>
              <Save size={16} aria-hidden="true" />{adding ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button role="switch" aria-checked={local.active} aria-label={`Activer ${svc.name}`} onClick={async () => { const active = !local.active; if (await onToggle(svc.id, active)) setLocal(l => ({ ...l, active })); }} className={`toggle ${local.active ? 'on' : ''}`} title={local.active ? 'Désactiver' : 'Activer'} style={{ flexShrink: 0 }} />
            <button onClick={() => onDelete(svc.id, svc.name)} className="btn btn-danger btn-sm" style={{ flex: 1, minWidth: 0 }}>
              <Trash2 size={16} aria-hidden="true" /> Supprimer
            </button>
          </div>

          {/* Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor={`edit-${svc.id}-name`}>Nom affiché</label>
              <input id={`edit-${svc.id}-name`} type="text" value={local.name} onChange={e => setLocal(l => ({ ...l, name: e.target.value }))} className="dash-input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor={`edit-${svc.id}-tagline`}>Phrase d&apos;accroche</label>
              <input id={`edit-${svc.id}-tagline`} type="text" value={local.tagline} onChange={e => setLocal(l => ({ ...l, tagline: e.target.value }))} className="dash-input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`edit-${svc.id}-price`}>Prix (€)</label>
              <input id={`edit-${svc.id}-price`} type="number" min="0.01" step="0.01" value={local.price} onChange={e => setLocal(l => ({ ...l, price: +e.target.value }))} className="dash-input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`edit-${svc.id}-original`}>Référence (€)</label>
              <input id={`edit-${svc.id}-original`} type="number" min="0.01" step="0.01" value={local.original} onChange={e => setLocal(l => ({ ...l, original: +e.target.value }))} className="dash-input" />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor={`edit-${svc.id}-slots`}>Places max</label>
              <input id={`edit-${svc.id}-slots`} type="number" min="1" value={local.maxSlots} onChange={e => setLocal(l => ({ ...l, maxSlots: +e.target.value }))} className="dash-input" />
            </div>
          </div>

          {/* Normaliser — collapsed by default */}
          <details style={{ marginBottom: 14 }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, padding: '6px 0', userSelect: 'none', listStyle: 'none' }}>
              🎯 Normaliser selon le catalogue…
            </summary>
            <div style={{ padding: '10px 0', marginTop: 8 }}>
              <select
                aria-label={`Modèle de référence pour ${svc.name}`}
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
                Modèle interne à vérifier auprès du fournisseur. Prix et places restent inchangés ; aucune autorisation commerciale n’est créée.
              </div>
            </div>
          </details>

          {/* Stock accounts */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              🔑 Comptes en stock ({svc.stocks?.length || 0})
            </div>
            {svc.stocks && svc.stocks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {svc.stocks.map(st => (
                  <div key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'SF Mono',Menlo,monospace" }}>
                        #{st.id.slice(0, 6)} · {st.filledSlots}/{st.maxSlots} slots · {fmt(st.price)}/mois
                      </span>
                      <button onClick={() => onEditStock(st)} className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>
                        <Pencil size={15} aria-hidden="true" /> Modifier
                      </button>
                    </div>
                    <div style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: '0.74rem', color: 'var(--text-gray)', wordBreak: 'break-all', lineHeight: 1.5 }}>
                      Identifiants masqués · consultation dans Stocks
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 8 }}>Nouveau compte de stock</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input aria-label={`Prix du nouveau stock ${svc.name}`} type="number" min="0.01" step="0.01" placeholder="Prix (€)" value={addPrice}
                  onChange={e => setAddPrice(e.target.value)} className="dash-input" style={{ fontSize: '0.78rem', padding: '7px 9px' }} />
                <input aria-label={`Places du nouveau stock ${svc.name}`} type="number" min="1" placeholder="Places max" value={addSlots}
                  onChange={e => setAddSlots(e.target.value)} className="dash-input" style={{ fontSize: '0.78rem', padding: '7px 9px' }} />
              </div>
              <textarea aria-label={`Identifiants du nouveau stock ${svc.name}`} rows={2} placeholder="Identifiants ou lien d’invitation" value={addDetails}
                onChange={e => setAddDetails(e.target.value)} className="dash-input"
                style={{ resize: 'vertical', minHeight: 50, fontSize: '0.78rem', padding: '7px 9px', fontFamily: "'SF Mono',Menlo,monospace" }} />
              {(addPrice || addSlots || addDetails) && !(addPrice && addSlots && addDetails) && <p role="alert" className="error-box">Renseignez le prix, les places et les identifiants avant d’enregistrer.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
