'use client';

import React, { useState, useEffect, useRef } from 'react';

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
  service: { name: string; icon: string; gradient: string };
  chats?: { id: string; orderId: string; messages: Message[] };
}

type View = 'storefront' | 'dashboard';
type DashTab = 'orders' | 'chat';
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
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Calculator
  const [calcSel, setCalcSel] = useState<Record<string, boolean>>({
    netflix: false, youtube: true, spotify: false, disney: true, surfshark: true,
  });

  // Espace client
  const [clientEmail, setClientEmail] = useState('');
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

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => { if (d.success) setServices(d.services); });
    fetch('/api/stocks/public').then(r => r.json()).then(d => { if (d.success) setStocks(d.stocks); });

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') && params.get('email')) {
      setView('dashboard');
      const email = params.get('email')!;
      setClientEmail(email);
      fetchOrders(email);
    }
  }, []);

  useEffect(() => {
    if (activeChatOrderId) {
      fetchChat(activeChatOrderId);
      chatPollRef.current = setInterval(() => fetchChat(activeChatOrderId), 5000);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [activeChatOrderId]);

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

  const fetchChat = async (orderId: string) => {
    try {
      const r = await fetch(`/api/chat?orderId=${orderId}`);
      const d = await r.json();
      if (d.success && d.thread) setChatMessages(d.thread.messages || []);
    } catch {}
  };

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

  const faqItems = [
    {
      q: 'Comment fonctionne StreamMalin ?',
      a: 'StreamMalin achète des abonnements de groupe ou familiaux officiels à l\'étranger dans des zones où les tarifs sont beaucoup plus bas. Nous gérons la configuration technique, la facturation et vous louons des places de profil ou des invitations familiales à prix coûtant. Vous économisez jusqu\'à 80% !',
    },
    {
      q: 'Le partage de place est-il légal et sécurisé ?',
      a: 'Oui, 100% légal et sécurisé. Les abonnements familiaux ou multi-profils de YouTube, Disney+ ou Surfshark sont officiellement conçus par les éditeurs pour être utilisés sur plusieurs écrans et comptes séparés. Vous possédez votre propre profil privé ou votre invitation individuelle. Vos données sont privées.',
    },
    {
      q: 'Y a-t-il un engagement sur mes abonnements ?',
      a: 'Aucun engagement de durée. Vous payez au mois le mois et pouvez résilier votre location à tout moment d\'un simple clic depuis votre Espace Client. L\'abonnement s\'arrête simplement à la fin de votre période mensuelle payée.',
    },
    {
      q: 'Que se passe-t-il si un compte cesse de fonctionner ?',
      a: 'Nous fournissons une Garantie Anti-Coupure exclusive. Si vous rencontrez la moindre difficulté d\'accès, notre équipe intervient immédiatement pour mettre à jour les accès ou vous transférer sur un autre compte de stock en moins de 24 heures ouvrées.',
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
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b0c10]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setView('storefront')}
            className="logo flex items-center gap-2 font-extrabold text-lg"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black" style={{ background: 'var(--gradient-primary)' }}>SM</div>
            <span className="gradient-text">StreamMalin</span>
          </button>

          <nav className={`${menuOpen ? 'flex' : 'hidden'} md:flex items-center gap-6 absolute md:relative top-16 md:top-0 left-0 right-0 md:left-auto md:right-auto bg-[#0b0c10] md:bg-transparent p-4 md:p-0 border-b md:border-0 border-white/5 flex-col md:flex-row`}>
            <a href="#offres" onClick={() => { setView('storefront'); setMenuOpen(false); }} className="text-sm text-[#9ca3af] hover:text-white transition-colors">Offres Premium</a>
            <a href="#calculateur" onClick={() => setMenuOpen(false)} className="text-sm text-[#9ca3af] hover:text-white transition-colors">Calculateur d&apos;Économies</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="text-sm text-[#9ca3af] hover:text-white transition-colors">FAQ</a>
            <button
              onClick={() => { setView('dashboard'); setMenuOpen(false); }}
              className="flex items-center gap-2 text-sm text-[#9ca3af] hover:text-white transition-colors"
            >
              <span>👤</span> Espace Client
            </button>
          </nav>

          <button className="md:hidden text-white text-xl" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>
      </header>

      {/* ======================== STOREFRONT ======================== */}
      {view === 'storefront' && (
        <main>
          {/* HERO */}
          <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
            <div className="max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-xs text-[#9ca3af] mb-8 backdrop-blur-sm bg-white/5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                FUSION STREAMING B2C EN DIRECT
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
                Le streaming premium,{' '}
                <span className="gradient-text">version maline.</span>
              </h1>
              <p className="text-lg text-[#9ca3af] font-light max-w-2xl mx-auto mb-10">
                Profitez de vos abonnements favoris à l&apos;année ou au mois avec des remises jusqu&apos;à <strong className="text-white">75%</strong> grâce à nos places partagées sécurisées.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <a href="#offres" className="btn btn-primary px-8 py-4 text-base font-bold rounded-2xl flex items-center gap-2">
                  Découvrir les Offres →
                </a>
                <button onClick={() => setView('dashboard')} className="btn btn-outline px-8 py-4 text-base rounded-2xl flex items-center gap-2 text-[#9ca3af]">
                  <span>👤</span> Mon Espace Client
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-[#9ca3af]">
                <span className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Support client 24/7 par Chat</span>
                <span className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Livraison Instantanée par Mail</span>
                <span className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Mise en route facile</span>
              </div>
            </div>
          </section>

          {/* CATALOGUE */}
          <section id="offres" className="py-20 px-6">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-white mb-3">
                  Catalogue des <span className="gradient-text">Abonnements</span>
                </h2>
                <p className="text-[#9ca3af] font-light">Sélectionnez votre service. Les accès sécurisés sont envoyés immédiatement après validation.</p>
              </div>

              {/* Filtres */}
              <div className="flex flex-wrap gap-3 justify-center mb-10">
                {([['all', 'Tous'], ['streaming', 'Streaming Vidéo'], ['musique', 'Musique'], ['securite', 'Sécurité & VPN']] as [FilterType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`filter-btn ${filter === key ? 'active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Grid services */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredServices.map((s) => {
                  const discount = Math.round((1 - s.price / s.original) * 100);
                  const savings = (s.original - s.price).toFixed(2);
                  const hasStock = s.availableSlots > 0;
                  return (
                    <div key={s.id} className="glass-panel rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 flex flex-col">
                      {/* Banner */}
                      <div className="relative h-24 flex items-center justify-center" style={{ background: s.gradient }}>
                        <span className="absolute top-3 right-3 text-xs font-black text-white bg-black/30 px-2 py-0.5 rounded-full">-{discount}%</span>
                        <span className="text-4xl">{s.icon}</span>
                      </div>
                      {/* Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-extrabold text-white text-base mb-1">{s.name}</h3>
                        <p className="text-xs text-[#9ca3af] font-light mb-3">{s.tagline}</p>
                        <ul className="space-y-1.5 mb-4 flex-1">
                          {s.features.slice(0, 3).map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-[#9ca3af]">
                              <span className="text-cyan-400 shrink-0 mt-0.5">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-white">{s.price.toFixed(2)}€</span>
                            <span className="text-sm line-through text-[#6b7280]">{s.original.toFixed(2)}€</span>
                            <span className="text-xs text-[#9ca3af]">/ mois</span>
                          </div>
                          <p className="text-xs text-cyan-400 font-bold mt-0.5">Économie : {savings}€/mois</p>
                        </div>
                        {hasStock ? (
                          <a
                            href={`/checkout?service=${s.id}&stock=${s.availableStockId}`}
                            className="btn btn-primary w-full justify-center text-sm rounded-xl py-2.5"
                          >
                            Louer un accès
                          </a>
                        ) : (
                          <>
                            <p className="text-xs text-red-400 font-bold mb-2">RUPTURE DE STOCK · {s.availableSlots} places</p>
                            <button disabled className="w-full py-2.5 rounded-xl bg-white/5 text-[#6b7280] text-sm cursor-not-allowed">Plus disponible</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredServices.length === 0 && (
                  <div className="col-span-4 text-center py-12 text-[#9ca3af] font-light">Chargement des services...</div>
                )}
              </div>
            </div>
          </section>

          {/* MARKETPLACE */}
          <section id="marketplace" className="py-20 px-6 bg-[#060713]/60">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-white mb-3">
                  Abonnements premium <span className="gradient-text">disponibles</span>
                </h2>
                <p className="text-[#9ca3af] font-light">Choisissez votre place sécurisée. Vos accès sont gérés en direct et garantis par notre équipe.</p>
              </div>

              <div className="space-y-4 max-w-4xl mx-auto">
                {filteredStocks.length === 0 ? (
                  <div className="glass-panel rounded-2xl p-12 text-center text-[#9ca3af] font-light">
                    Aucun accès disponible en stock actuellement pour ce service. Notre équipe réapprovisionne régulièrement, revenez d&apos;ici quelques minutes !
                  </div>
                ) : (
                  filteredStocks.map((stock) => {
                    const avSlots = stock.maxSlots - stock.filledSlots;
                    return (
                      <div key={stock.id} className="glass-panel rounded-2xl p-5 flex items-center gap-5 hover:scale-[1.01] transition-transform">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: stock.service.gradient }}>
                          {stock.service.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <h4 className="font-bold text-white text-base">{stock.service.name}</h4>
                              <p className="text-xs text-[#9ca3af]">🛡️ Accès Officiel · Stable &amp; Garanti</p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <div className="text-xl font-black text-white">{stock.price.toFixed(2)}€</div>
                              <div className="text-[10px] text-[#9ca3af]">/mois tout inclus</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-cyan-400">{avSlots} place{avSlots > 1 ? 's' : ''} libre{avSlots > 1 ? 's' : ''}</span>
                              <div className="flex gap-1">
                                {slotDots(stock.maxSlots, stock.filledSlots)}
                              </div>
                            </div>
                            <a
                              href={`/checkout?service=${stock.serviceId}&stock=${stock.id}`}
                              className="btn btn-primary btn-sm rounded-xl px-4 py-2 text-xs ml-4 shrink-0"
                            >
                              Louer mon accès
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* CALCULATEUR D'ÉCONOMIES */}
          <section id="calculateur" className="py-20 px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-white mb-3">
                  Pourquoi payer le <span className="gradient-text">tarif plein</span> ?
                </h2>
                <p className="text-[#9ca3af] font-light">Comparez les tarifs officiels avec les prix réduits exclusifs de StreamMalin</p>
              </div>

              <div className="glass-panel rounded-2xl p-8">
                {/* Header tableau */}
                <div className="grid grid-cols-4 pb-4 border-b border-white/10 text-xs font-bold text-[#9ca3af] uppercase tracking-wider">
                  <div>Service Streaming</div>
                  <div className="text-center">Tarif Public France</div>
                  <div className="text-center text-cyan-400">StreamMalin</div>
                  <div className="text-center text-cyan-400">Votre Économie</div>
                </div>

                {services.map((s) => {
                  const savings = (s.original - s.price).toFixed(2);
                  const pct = Math.round((1 - s.price / s.original) * 100);
                  return (
                    <div key={s.id} className="grid grid-cols-4 py-5 border-b border-white/5 items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{s.icon}</span>
                        <div>
                          <div className="font-semibold text-white text-sm">{s.name}</div>
                          <div className="text-xs text-[#9ca3af] font-light">{s.tagline.slice(0, 35)}</div>
                        </div>
                      </div>
                      <div className="text-center line-through text-[#6b7280] text-sm">{s.original.toFixed(2)}€ / mois</div>
                      <div className="text-center font-black text-cyan-400 text-lg">{s.price.toFixed(2)}€ / mois</div>
                      <div className="flex justify-center">
                        <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-full">
                          -{pct}% (Économisez {savings}€/m)
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Calculateur */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4">🧮 Calculateur d&apos;économies personnalisé</h3>
                  <div className="flex flex-wrap gap-3 mb-6">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setCalcSel(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                          calcSel[s.id]
                            ? 'border-cyan-400 bg-cyan-400/10 text-white'
                            : 'border-white/10 bg-white/5 text-[#9ca3af]'
                        }`}
                      >
                        <span>{s.icon}</span> {s.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="glass-panel rounded-xl p-4">
                      <div className="text-xs text-[#9ca3af] mb-1">Tarif public cumulé</div>
                      <div className="text-2xl font-black line-through text-[#6b7280]">{calcOriginal.toFixed(2)}€</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4">
                      <div className="text-xs text-[#9ca3af] mb-1">Avec StreamMalin</div>
                      <div className="text-2xl font-black gradient-text">{calcTotal.toFixed(2)}€</div>
                    </div>
                    <div className="glass-panel rounded-xl p-4">
                      <div className="text-xs text-[#9ca3af] mb-1">Vous économisez</div>
                      <div className="text-2xl font-black text-cyan-400">{calcSavings.toFixed(2)}€/m</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-[#9ca3af]">
                    🚀 En cumulant vos abonnements, vous économisez{' '}
                    <strong className="text-cyan-400">{(calcSavings * 12).toFixed(0)}€ par an</strong> !
                  </p>
                  <a href="#offres" className="btn btn-primary rounded-xl px-6 py-2.5 text-sm">
                    🔥 Choisir mes abonnements
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* COMMENT ÇA MARCHE */}
          <section id="comment" className="py-20 px-6 bg-[#060713]/60">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-white mb-3">
                  Comment ça <span className="gradient-text">marche</span> ?
                </h2>
                <p className="text-[#9ca3af] font-light">Le partage d&apos;abonnement en 3 étapes simples pour tous</p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { n: '1', title: 'Sélectionnez une offre', text: 'Parcourez notre catalogue et choisissez l\'offre qui correspond à vos besoins parmi nos services premium.' },
                  { n: '2', title: 'Réglez en sécurité', text: 'Payez chaque mois par carte bancaire, PayPal (Biens & Services) ou cryptomonnaies. Transactions 100% sécurisées.' },
                  { n: '3', title: 'Accédez instantanément', text: 'Récupérez les identifiants ou le lien d\'invitation directement dans votre Espace Client et profitez immédiatement.' },
                ].map((step) => (
                  <div key={step.n} className="glass-panel rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white mx-auto mb-6" style={{ background: 'var(--gradient-primary)' }}>
                      {step.n}
                    </div>
                    <h3 className="font-extrabold text-white text-lg mb-3">{step.title}</h3>
                    <p className="text-[#9ca3af] font-light text-sm leading-relaxed">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* GARANTIES */}
          <section className="py-20 px-6">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-white mb-3">
                  Partagez en toute <span className="gradient-text">sérénité</span>
                </h2>
                <p className="text-[#9ca3af] font-light">Sécurité renforcée et conformité légale garanties à 100%</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: '🛡️', title: 'Protection Acheteur', text: 'Remplacement ou remboursement immédiat si le compte partagé présente un défaut.' },
                  { icon: '🔐', title: 'Identifiants Chiffrés', text: 'Vos mots de passe et liens de connexion sont cryptés avec la norme de sécurité AES-256.' },
                  { icon: '⚡', title: 'Livraison Flash', text: 'Pas d\'attente. Votre accès Premium est disponible dès la confirmation de la transaction.' },
                  { icon: '💬', title: 'Support 7j/7', text: 'Une équipe d\'assistance dédiée est à votre disposition en français pour résoudre tout conflit.' },
                ].map((g, i) => (
                  <div key={i} className="glass-panel rounded-2xl p-6 text-center hover:scale-[1.02] transition-transform">
                    <div className="text-4xl mb-4">{g.icon}</div>
                    <h4 className="font-bold text-white mb-2">{g.title}</h4>
                    <p className="text-xs text-[#9ca3af] font-light leading-relaxed">{g.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="py-20 px-6 bg-[#060713]/60">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black text-white mb-3">
                  Questions <span className="gradient-text">fréquentes</span>
                </h2>
                <p className="text-[#9ca3af] font-light">Toutes les réponses à vos interrogations</p>
              </div>
              <div className="space-y-3">
                {faqItems.map((item, i) => (
                  <div key={i} className={`faq-item glass-panel rounded-xl overflow-hidden ${faqOpen === i ? 'open' : ''}`}>
                    <button
                      className="w-full flex items-center justify-between px-6 py-5 text-left"
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    >
                      <span className="font-semibold text-white text-sm">{item.q}</span>
                      <span className="text-xl text-[#9ca3af] shrink-0 ml-4">{faqOpen === i ? '−' : '+'}</span>
                    </button>
                    {faqOpen === i && (
                      <div className="px-6 pb-5">
                        <p className="text-sm text-[#9ca3af] font-light leading-relaxed">{item.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="glass-panel rounded-3xl p-12 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ background: 'var(--gradient-primary)' }} />
                <div className="relative">
                  <h2 className="text-4xl font-black text-white mb-4">Prêt à réduire vos factures dès aujourd&apos;hui ?</h2>
                  <p className="text-[#9ca3af] font-light mb-8 max-w-xl mx-auto">Rejoignez nos clients économes. Accès instantané, résiliable à tout moment, sans engagement.</p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <a href="#offres" onClick={() => setFilter('streaming')} className="btn btn-primary rounded-xl px-6 py-3 text-sm font-bold">▶ YouTube Premium — dès 3,49€</a>
                    <a href="#offres" onClick={() => setFilter('streaming')} className="btn btn-outline rounded-xl px-6 py-3 text-sm font-bold text-white">✦ Disney+ — dès 2,99€</a>
                    <a href="#offres" onClick={() => setFilter('securite')} className="btn btn-outline rounded-xl px-6 py-3 text-sm font-bold text-white">🦈 Surfshark VPN — dès 1,49€</a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ======================== DASHBOARD CLIENT ======================== */}
      {view === 'dashboard' && (
        <main className="pt-24 pb-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-black text-white">
                👤 Espace Client <span className="gradient-text">StreamMalin</span>
              </h2>
              <button onClick={() => setView('storefront')} className="btn btn-outline btn-sm rounded-xl text-sm text-[#9ca3af]">← Retour à la boutique</button>
            </div>
            <p className="text-[#9ca3af] text-sm font-light mb-8">Gérez vos abonnements rejoints et discutez en toute sécurité avec notre équipe de support client.</p>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Sidebar */}
              <aside className="md:col-span-3 glass-panel rounded-2xl p-4 h-fit">
                <div className="space-y-1">
                  {([['orders', '📦', 'Mes Abonnements Rejoins'], ['chat', '💬', 'Support Client 24/7']] as [DashTab, string, string][]).map(([tab, icon, label]) => (
                    <button
                      key={tab}
                      onClick={() => setDashTab(tab)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                        dashTab === tab
                          ? 'text-white'
                          : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
                      }`}
                      style={dashTab === tab ? { background: 'var(--gradient-primary)' } : {}}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  ))}
                </div>
              </aside>

              {/* Content */}
              <div className="md:col-span-9">
                {/* Email lookup */}
                {!searchedEmail && (
                  <div className="glass-panel rounded-2xl p-8 mb-6">
                    <h3 className="font-bold text-white mb-4">🔍 Retrouver mes commandes</h3>
                    <form onSubmit={(e) => { e.preventDefault(); fetchOrders(clientEmail); }} className="flex gap-3">
                      <input
                        type="email"
                        placeholder="Entrez l&apos;email utilisé lors de votre achat..."
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl bg-[#141524] border border-white/10 text-white placeholder-[#6b7280] focus:outline-none focus:border-purple-500 transition-all text-sm"
                        required
                      />
                      <button type="submit" disabled={loadingOrders} className="btn btn-primary rounded-xl px-6 py-3 text-sm font-bold shrink-0">
                        {loadingOrders ? '...' : 'Rechercher'}
                      </button>
                    </form>
                    {ordersError && <p className="text-red-400 text-xs mt-3">{ordersError}</p>}
                  </div>
                )}

                {/* Orders tab */}
                {dashTab === 'orders' && (
                  <div>
                    {searchedEmail && orders.length === 0 && !loadingOrders && (
                      <div className="glass-panel rounded-2xl p-12 text-center text-[#9ca3af] font-light">
                        Aucun abonnement actif trouvé pour <strong className="text-white">{searchedEmail}</strong>.<br />
                        <button onClick={() => { setSearchedEmail(''); setOrders([]); }} className="text-cyan-400 text-sm mt-2 underline">Chercher un autre email</button>
                      </div>
                    )}
                    {orders.map((order) => (
                      <div key={order.id} className="glass-panel rounded-2xl p-6 mb-4 flex flex-col sm:flex-row gap-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: order.service.gradient }}>
                          {order.service.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-white">{order.service.name}</h4>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,230,118,0.15)', color: 'var(--accent-green)' }}>Actif</span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-[#9ca3af] mb-4">
                            <span>Fournisseur : <strong className="text-white">StreamMalin Support</strong></span>
                            <span>Mensualité : <strong className="text-white">{order.price.toFixed(2)}€</strong></span>
                            <span>Loué le : <strong className="text-white">{new Date(order.date).toLocaleDateString('fr-FR')}</strong></span>
                          </div>
                          <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-4">
                            <div className="text-xs text-[#9ca3af] mb-1.5">🔑 Vos accès de connexion sécurisés</div>
                            <div className="text-sm text-white font-mono break-all">{order.details}</div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => { setDashTab('chat'); setActiveChatOrderId(order.id); fetchChat(order.id); }}
                              className="btn btn-primary btn-sm rounded-xl text-xs"
                            >💬 Ouvrir le Support</button>
                            <button
                              onClick={() => navigator.clipboard.writeText(order.details)}
                              className="btn btn-outline btn-sm rounded-xl text-xs text-[#9ca3af]"
                            >📋 Copier les accès</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat tab */}
                {dashTab === 'chat' && (
                  <div className="glass-panel rounded-2xl overflow-hidden">
                    {!activeChatOrderId ? (
                      <div className="p-16 text-center text-[#9ca3af] font-light">
                        <div className="text-5xl mb-4">💬</div>
                        Sélectionnez un abonnement dans l&apos;onglet &quot;Mes Abonnements&quot; pour ouvrir le chat support.
                      </div>
                    ) : (
                      <>
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span className="font-semibold text-white text-sm">
                              {orders.find(o => o.id === activeChatOrderId)?.service.name || 'Support'}
                            </span>
                          </div>
                          <span className="text-xs text-[#6b7280]">🔒 Messagerie chiffrée SSL</span>
                        </div>
                        {/* Messages */}
                        <div className="h-80 overflow-y-auto p-5 space-y-3">
                          {chatMessages.length === 0 ? (
                            <div className="text-center text-[#9ca3af] text-sm py-12 font-light">Aucun message pour le moment.</div>
                          ) : (
                            chatMessages.map((msg) => {
                              const isSelf = msg.sender === 'Vous';
                              return (
                                <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                    isSelf
                                      ? 'text-white rounded-tr-none'
                                      : 'bg-[#181926] border border-white/5 text-[#e5e7eb] rounded-tl-none'
                                  }`} style={isSelf ? { background: 'var(--gradient-primary)' } : {}}>
                                    {!isSelf && <div className="text-xs text-[#9ca3af] mb-1 font-semibold">{msg.sender}</div>}
                                    <p className="whitespace-pre-wrap font-light">{msg.text}</p>
                                    <span className="text-[9px] opacity-50 block text-right mt-1">
                                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={chatBottomRef} />
                        </div>
                        {/* Input */}
                        <form onSubmit={sendMessage} className="p-4 border-t border-white/5 flex gap-2">
                          <input
                            type="text"
                            placeholder="Tapez votre message pour le support..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500 transition-all"
                          />
                          <button
                            type="submit"
                            disabled={sendingMsg || !chatInput.trim()}
                            className="px-5 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                            style={{ background: 'var(--gradient-primary)' }}
                          >
                            Envoyer
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-[#060713]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 font-extrabold text-lg mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ background: 'var(--gradient-primary)' }}>SM</div>
                <span className="gradient-text">StreamMalin</span>
              </div>
              <p className="text-xs text-[#6b7280] font-light leading-relaxed">La plateforme B2C de confiance pour accéder à des abonnements streaming premium à tarif réduit en France.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Services</h4>
              {['Netflix Premium', 'YouTube Premium', 'Spotify Premium', 'Disney+', 'Surfshark VPN'].map(s => (
                <a key={s} href="#offres" className="block text-xs text-[#6b7280] hover:text-white mb-2 transition-colors">{s}</a>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Navigation</h4>
              <button onClick={() => setView('dashboard')} className="block text-xs text-[#6b7280] hover:text-white mb-2 transition-colors">👤 Mon Espace Client</button>
              <a href="#faq" className="block text-xs text-[#6b7280] hover:text-white mb-2 transition-colors">FAQ &amp; Centre d&apos;aide</a>
              <a href="#calculateur" className="block text-xs text-[#6b7280] hover:text-white mb-2 transition-colors">Calculateur d&apos;économies</a>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Sécurité</h4>
              <p className="text-xs text-[#6b7280] font-light">🔒 Serveurs cryptés AES-256 &amp; Transactions conformes PCI-DSS</p>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 text-center text-xs text-[#6b7280]">
            <p>© {new Date().getFullYear()} StreamMalin. Tous droits réservés. Service de courtage d&apos;abonnements de streaming partagés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
