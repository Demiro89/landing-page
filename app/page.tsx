'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Tv,
  Music,
  Shield,
  Send,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  User,
  MessageCircle,
  HelpCircle,
  Clock,
  Unlock,
  AlertCircle,
  Check
} from 'lucide-react';

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
  service: {
    name: string;
    icon: string;
    gradient: string;
  };
  chats?: {
    id: string;
    messages: Message[];
  };
}

export default function Home() {
  // State variables
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('offers'); // 'offers', 'cclient'
  const [filter, setFilter] = useState<string>('all'); // 'all', 'streaming', 'music', 'vpn'

  // Espace Client States
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [fetchingOrders, setFetchingOrders] = useState<boolean>(false);
  const [ordersLoaded, setOrdersLoaded] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string>('');

  // Chat States
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMsgText, setNewMsgText] = useState<string>('');
  const [sendingMsg, setSendingMsg] = useState<boolean>(false);

  // Calculator States
  const [calcNetflix, setCalcNetflix] = useState<boolean>(false);
  const [calcYoutube, setCalcYoutube] = useState<boolean>(true);
  const [calcSpotify, setCalcSpotify] = useState<boolean>(false);
  const [calcDisney, setCalcDisney] = useState<boolean>(true);
  const [calcSurfshark, setCalcSurfshark] = useState<boolean>(true);

  // FAQ States
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({
    0: true,
    1: false,
    2: false,
    3: false,
  });

  // Reference for chat message list to scroll to bottom
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatIntervalRef = useRef<any>(null);

  // Fetch public services on mount
  useEffect(() => {
    fetchServices();
    
    // Check if redirecting from a successful checkout session
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const email = urlParams.get('email');
    if (success && email) {
      setActiveTab('cclient');
      setClientEmail(email);
      handleFetchOrders(email);
    }
  }, []);

  // Poll for new chat messages when a chat is open
  useEffect(() => {
    if (activeOrderId && activeTab === 'cclient') {
      fetchChatMessages(activeOrderId);
      
      // Auto-poll support chat every 5 seconds
      chatIntervalRef.current = setInterval(() => {
        fetchChatMessages(activeOrderId, false);
      }, 5000);
    }

    return () => {
      if (chatIntervalRef.current) clearInterval(chatIntervalRef.current);
    };
  }, [activeOrderId, activeTab]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.success) {
        setServices(data.services);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchOrders = async (emailToFetch?: string) => {
    const email = emailToFetch || clientEmail;
    if (!email) return;

    setFetchingOrders(true);
    setOrdersError('');
    setClientOrders([]);
    setActiveOrderId(null);

    try {
      const res = await fetch(`/api/client/orders?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.success) {
        setClientOrders(data.orders);
        setOrdersLoaded(true);
        if (data.orders.length > 0) {
          setActiveOrderId(data.orders[0].id);
        }
      } else {
        setOrdersError(data.error || 'Erreur lors de la récupération');
      }
    } catch (err) {
      setOrdersError('Erreur de connexion avec le serveur');
    } finally {
      setFetchingOrders(false);
    }
  };

  const fetchChatMessages = async (orderId: string, showLoader = true) => {
    try {
      const res = await fetch(`/api/chat?orderId=${orderId}`);
      const data = await res.json();
      if (data.success && data.thread) {
        setChatMessages(data.thread.messages);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim() || !activeOrderId || sendingMsg) return;

    setSendingMsg(true);
    const tempText = newMsgText;
    setNewMsgText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrderId,
          text: tempText,
          sender: 'Vous',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setChatMessages((prev) => [...prev, data.message]);
      } else {
        setNewMsgText(tempText); // Restore if error
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMsgText(tempText);
    } finally {
      setSendingMsg(false);
    }
  };

  // Filter logic
  const filteredServices = services.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'streaming') return s.id === 'netflix' || s.id === 'disney' || s.id === 'youtube';
    if (filter === 'music') return s.id === 'spotify';
    if (filter === 'vpn') return s.id === 'surfshark';
    return true;
  });

  // Calculator math
  const officialCost =
    (calcNetflix ? 19.99 : 0) +
    (calcYoutube ? 13.99 : 0) +
    (calcSpotify ? 10.99 : 0) +
    (calcDisney ? 15.99 : 0) +
    (calcSurfshark ? 12.99 : 0);

  const streamMalinCost =
    (calcNetflix ? 5.49 : 0) +
    (calcYoutube ? 3.49 : 0) +
    (calcSpotify ? 2.99 : 0) +
    (calcDisney ? 2.99 : 0) +
    (calcSurfshark ? 1.49 : 0);

  const monthlySavings = officialCost - streamMalinCost;
  const yearlySavings = monthlySavings * 12;

  return (
    <div>
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#060713]/85 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#a855f7] to-[#3b82f6] flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-purple-500/25">
              SM
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">
              StreamMalin
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => setActiveTab('offers')}
              className={`text-sm font-medium transition-colors ${
                activeTab === 'offers' ? 'text-white' : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              Offres Premium
            </button>
            <button
              onClick={() => {
                setActiveTab('offers');
                document.getElementById('economies')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-[#9ca3af] hover:text-white transition-colors"
            >
              Calculateur d&apos;Économies
            </button>
            <button
              onClick={() => {
                setActiveTab('offers');
                document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-[#9ca3af] hover:text-white transition-colors"
            >
              FAQ
            </button>
            <button
              onClick={() => setActiveTab('cclient')}
              className={`btn btn-sm btn-ghost gap-2 ${
                activeTab === 'cclient' ? 'border-[#a855f7] text-white' : ''
              }`}
            >
              <User className="w-4 h-4 text-purple-400" />
              Espace Client
            </button>
          </nav>
        </div>
      </header>

      {/* HERO SECTION */}
      {activeTab === 'offers' && (
        <>
          <section className="pt-32 pb-20 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 text-center">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/10 text-xs font-semibold text-purple-300 mb-6 tracking-wide">
                <Sparkles className="w-3.5 h-3.5" /> FUSION STREAMING B2C EN DIRECT
              </span>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                Le streaming premium, <br />
                <span className="bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">
                  version maline.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-[#9ca3af] max-w-2xl mx-auto mb-10 font-light">
                Profitez de vos abonnements favoris à l&apos;année ou au mois avec des remises jusqu&apos;à <strong className="text-white font-semibold">75%</strong> grâce à nos places partagées sécurisées.
              </p>

              <div className="flex gap-4 justify-center flex-wrap mb-16">
                <a
                  href="#catalog"
                  className="btn btn-primary btn-lg"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Découvrir les Offres <ArrowRight className="w-4 h-4" />
                </a>
                <button onClick={() => setActiveTab('cclient')} className="btn btn-ghost btn-lg gap-2">
                  <User className="w-5 h-5 text-purple-400" /> Mon Espace Client
                </button>
              </div>

              <div className="flex justify-center gap-6 md:gap-12 flex-wrap max-w-4xl mx-auto border-t border-white/5 pt-12">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#10b981] shrink-0" />
                  <span className="text-sm font-medium text-[#9ca3af]">Support client 24/7 par Chat</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#10b981] shrink-0" />
                  <span className="text-sm font-medium text-[#9ca3af]">Livraison Instantanée par Mail</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#10b981] shrink-0" />
                  <span className="text-sm font-medium text-[#9ca3af]">Mise en route facile</span>
                </div>
              </div>
            </div>
          </section>

          {/* SERVICE CATALOG */}
          <section id="catalog" className="py-20 border-t border-white/5 bg-[#0e0f19]/40">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                  Catalogue des <span className="bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">Abonnements</span>
                </h2>
                <p className="text-[#9ca3af] max-w-lg mx-auto font-light">
                  Sélectionnez votre service. Les accès sécurisés sont envoyés immédiatement après validation.
                </p>
              </div>

              {/* Filters */}
              <div className="flex justify-center gap-3 mb-10 flex-wrap">
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'streaming', label: 'Streaming Vidéo' },
                  { id: 'music', label: 'Musique' },
                  { id: 'vpn', label: 'Sécurité & VPN' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setFilter(btn.id)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                      filter === btn.id
                        ? 'bg-gradient-to-r from-[#a855f7] to-[#3b82f6] text-white shadow-md shadow-purple-500/20'
                        : 'bg-[#181926] border border-white/5 text-[#9ca3af] hover:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Catalog Grid */}
              {loading ? (
                <div className="text-center py-20 text-[#9ca3af] font-light">
                  Chargement des stocks StreamMalin...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {filteredServices.map((service) => {
                    const priceDiff = service.original - service.price;
                    const discount = Math.round((priceDiff / service.original) * 100);

                    return (
                      <div
                        key={service.id}
                        className="glass-panel group relative flex flex-col h-full hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300"
                        style={{ borderTop: `4px solid ${service.id === 'netflix' ? '#e50914' : service.id === 'youtube' ? '#ff0000' : service.id === 'spotify' ? '#1db954' : service.id === 'disney' ? '#0063e5' : service.id === 'surfshark' ? '#00d2fc' : '#a855f7'}` }}
                      >
                        {/* Discount Badge */}
                        <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                          -{discount}%
                        </div>

                        <div className="p-6 flex-1 flex flex-col">
                          {/* Header */}
                          <div className="flex items-center gap-4 mb-4">
                            <span className="text-3xl">{service.icon}</span>
                            <div>
                              <h3 className="text-xl font-bold text-white tracking-tight">
                                {service.name}
                              </h3>
                              <p className="text-xs text-[#9ca3af] font-light mt-0.5">
                                {service.tagline}
                              </p>
                            </div>
                          </div>

                          {/* Pricing */}
                          <div className="my-6">
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-extrabold text-white">
                                {service.price.toFixed(2)}€
                              </span>
                              <span className="text-sm text-[#9ca3af] line-through">
                                {service.original.toFixed(2)}€
                              </span>
                              <span className="text-xs text-[#9ca3af]/80">/ mois</span>
                            </div>
                            <p className="text-xs text-[#9ca3af] mt-1">
                              Économie : <strong className="text-white">{(service.original - service.price).toFixed(2)}€/mois</strong>
                            </p>
                          </div>

                          {/* Features */}
                          <ul className="space-y-3 mb-8 flex-1">
                            {service.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-xs text-[#9ca3af] font-light leading-relaxed">
                                <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Stock Status & Purchase */}
                          {service.availableSlots > 0 && service.availableStockId ? (
                            <div>
                              <div className="flex justify-between items-center text-[10px] text-[#9ca3af] font-medium mb-3">
                                <span>PLACES EN STOCK</span>
                                <span className="text-emerald-400">{service.availableSlots} places</span>
                              </div>
                              <a
                                href={`/checkout?service=${service.id}&stock=${service.availableStockId}`}
                                className="w-full btn btn-primary py-3 text-sm font-bold uppercase tracking-wider rounded-xl text-center block"
                              >
                                Souscrire
                              </a>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between items-center text-[10px] text-red-400 font-medium mb-3">
                                <span>RUPTURE DE STOCK</span>
                                <span>0 places</span>
                              </div>
                              <button
                                disabled
                                className="w-full bg-[#181926]/50 border border-white/5 text-[#9ca3af]/40 py-3 text-sm font-bold uppercase tracking-wider rounded-xl cursor-not-allowed text-center"
                              >
                                Plus disponible
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* CALCULATOR SECTION */}
          <section id="economies" className="py-20 border-t border-white/5 relative">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                  Calculez vos <span className="bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">Économies Annuelles</span>
                </h2>
                <p className="text-[#9ca3af] font-light">
                  Sélectionnez les plateformes que vous utilisez au quotidien et découvrez combien vous économiserez avec StreamMalin.
                </p>
              </div>

              <div className="glass-panel p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Checkboxes */}
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#9ca3af] mb-4">
                    Mes plateformes habituelles
                  </h4>

                  {[
                    { id: 'netflix', label: '🎬 Netflix Premium', state: calcNetflix, setState: setCalcNetflix },
                    { id: 'youtube', label: '▶ YouTube Premium', state: calcYoutube, setState: setCalcYoutube },
                    { id: 'spotify', label: '🎵 Spotify Premium', state: calcSpotify, setState: setCalcSpotify },
                    { id: 'disney', label: '✦ Disney+ Premium', state: calcDisney, setState: setCalcDisney },
                    { id: 'surfshark', label: '🦈 Surfshark VPN', state: calcSurfshark, setState: setCalcSurfshark },
                  ].map((plat) => (
                    <label
                      key={plat.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        plat.state
                          ? 'bg-purple-500/10 border-purple-500/30 text-white'
                          : 'bg-[#181926]/40 border-white/5 text-[#9ca3af]'
                      }`}
                    >
                      <span className="font-semibold text-sm">{plat.label}</span>
                      <input
                        type="checkbox"
                        checked={plat.state}
                        onChange={(e) => plat.setState(e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-white/10"
                      />
                    </label>
                  ))}
                </div>

                {/* Savings Display */}
                <div className="text-center bg-[#141525]/60 border border-white/5 rounded-2xl p-8 flex flex-col justify-center h-full">
                  <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
                    VOS ÉCONOMIES ESTIMÉES
                  </span>
                  <div className="text-5xl md:text-6xl font-black text-emerald-400 my-4 tracking-tight">
                    {yearlySavings.toFixed(0)}€
                  </div>
                  <span className="text-xs text-[#9ca3af] uppercase tracking-wider mb-6">
                    par an économisés
                  </span>

                  <div className="space-y-3 pt-6 border-t border-white/5 text-left text-xs font-light text-[#9ca3af]">
                    <div className="flex justify-between">
                      <span>Tarif officiel France :</span>
                      <span className="text-white font-medium">{(officialCost * 12).toFixed(2)}€/an</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarif StreamMalin :</span>
                      <span className="text-purple-400 font-medium">{(streamMalinCost * 12).toFixed(2)}€/an</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ SECTION */}
          <section id="faq" className="py-20 border-t border-white/5 bg-[#0e0f19]/20">
            <div className="max-w-3xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
                  Foire Aux <span className="bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">Questions</span>
                </h2>
                <p className="text-[#9ca3af] font-light">
                  Tout ce que vous devez savoir sur notre système d&apos;abonnements de stock.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    q: 'Comment fonctionne le partage d\'abonnement StreamMalin ?',
                    a: 'StreamMalin achète de grands comptes officiels légaux à l\'étranger ou en volume. Nous subdivisons ensuite ces abonnements familiaux ou multi-écrans pour vous louer une place (slot) exclusive. Vous profitez du même service sans payer le tarif plein.',
                  },
                  {
                    q: 'Est-ce légal et sécurisé ?',
                    a: 'Oui, tout à fait. Les comptes sont souscrits auprès de canaux de distribution officiels. Aucun crack ou carte volée. C\'est un abonnement parfaitement fonctionnel et stable, garanti 100% sans coupure.',
                  },
                  {
                    q: 'Comment se passe la livraison après mon achat ?',
                    a: 'La livraison est immédiate et automatisée ! Une fois le paiement validé (Stripe ou PayPal), vous recevez immédiatement vos accès (email, mot de passe ou lien d\'invitation) par email et ils s\'affichent aussi dans votre Espace Client sur le site.',
                  },
                  {
                    q: 'Puis-je contacter le support technique en cas de problème ?',
                    a: 'Bien sûr ! C\'est la force de StreamMalin : chaque commande active donne accès à un chat de support en direct dans votre Espace Client. Notre équipe répond en quelques minutes pour résoudre tout problème.',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="glass-panel overflow-hidden transition-all">
                    <button
                      onClick={() => setFaqOpen((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                    >
                      <span className="font-semibold text-white tracking-tight">{item.q}</span>
                      <HelpCircle className={`w-5 h-5 text-purple-400 transition-transform ${faqOpen[idx] ? 'rotate-180' : ''}`} />
                    </button>
                    {faqOpen[idx] && (
                      <div className="px-6 pb-6 text-sm text-[#9ca3af] font-light leading-relaxed border-t border-white/5 pt-4">
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* CLIENT SPACE TAB */}
      {activeTab === 'cclient' && (
        <section className="pt-32 pb-20 min-h-[90vh]">
          <div className="max-w-6xl mx-auto px-6">
            {!ordersLoaded ? (
              // Login / Fetch Orders Screen
              <div className="max-w-md mx-auto glass-panel p-8 text-center">
                <User className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                <h2 className="text-2xl font-extrabold text-white mb-2">Mon Espace Client</h2>
                <p className="text-sm text-[#9ca3af] mb-6 font-light">
                  Saisissez l&apos;adresse email utilisée lors de vos achats pour accéder instantanément à vos accès et au chat de support.
                </p>

                {ordersError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{ordersError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <input
                    type="email"
                    placeholder="votre-email@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#141524] border border-white/10 text-white placeholder-[#6b7280] focus:outline-none focus:border-purple-500 transition-all text-sm"
                  />
                  <button
                    onClick={() => handleFetchOrders()}
                    disabled={fetchingOrders || !clientEmail}
                    className="w-full btn btn-primary py-3 rounded-xl font-bold uppercase tracking-wider text-sm disabled:opacity-50"
                  >
                    {fetchingOrders ? 'Recherche...' : 'Accéder à mes abonnements'}
                  </button>
                </div>
              </div>
            ) : (
              // Orders Dashboard and Support Chat
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Subscriptions List */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-white">Mes Abonnements</h3>
                    <button
                      onClick={() => {
                        setOrdersLoaded(false);
                        setClientOrders([]);
                        setClientEmail('');
                      }}
                      className="text-xs text-purple-400 hover:underline"
                    >
                      Changer d&apos;email
                    </button>
                  </div>

                  {clientOrders.length === 0 ? (
                    <div className="glass-panel p-6 text-center text-sm text-[#9ca3af] font-light">
                      Aucun abonnement actif trouvé pour cet email.
                    </div>
                  ) : (
                    clientOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setActiveOrderId(order.id)}
                        className={`w-full text-left glass-panel p-5 transition-all relative overflow-hidden ${
                          activeOrderId === order.id
                            ? 'border-purple-500 bg-purple-500/5'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{order.service.icon}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white">{order.service.name}</span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Actif
                              </span>
                            </div>
                            <div className="text-[10px] text-[#9ca3af] mt-1 flex items-center gap-1.5 font-light">
                              <Clock className="w-3.5 h-3.5 text-purple-400" />
                              Payé : {order.price.toFixed(2)}€/mois
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Subscription Details & Chat Support */}
                <div className="lg:col-span-8 space-y-6">
                  {activeOrderId ? (
                    (() => {
                      const activeOrder = clientOrders.find((o) => o.id === activeOrderId);
                      if (!activeOrder) return null;

                      return (
                        <>
                          {/* Credentials Display Box */}
                          <div className="glass-panel p-6 border-l-4 border-purple-500">
                            <h4 className="text-sm font-extrabold uppercase tracking-wider text-[#9ca3af] mb-4 flex items-center gap-2">
                              <Unlock className="w-4 h-4 text-purple-400" /> Vos Identifiants de connexion
                            </h4>
                            <div className="p-4 bg-slate-950/70 border border-white/5 rounded-xl font-mono text-sm text-blue-400 whitespace-pre-wrap word-break-all select-all">
                              {activeOrder.details}
                            </div>
                            <p className="text-[10px] text-[#9ca3af] mt-3 font-light">
                              Ne modifiez jamais le mot de passe ni le profil alloué afin de préserver la garantie StreamMalin.
                            </p>
                          </div>

                          {/* Chat Support Messaging Screen */}
                          <div className="glass-panel flex flex-col h-[450px]">
                            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-[#111221]/50">
                              <MessageCircle className="w-5 h-5 text-purple-400" />
                              <div>
                                <h4 className="font-bold text-white text-sm">Chat Support StreamMalin</h4>
                                <p className="text-[10px] text-[#9ca3af] font-light">
                                  Une question sur votre compte {activeOrder.service.name} ? Écrivez-nous.
                                </p>
                              </div>
                            </div>

                            {/* Message List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                              {chatMessages.length === 0 ? (
                                <div className="text-center py-20 text-xs text-[#9ca3af] font-light">
                                  Aucun message. Envoyez votre question pour initier la discussion.
                                </div>
                              ) : (
                                chatMessages.map((msg) => {
                                  const isSelf = msg.sender === 'Vous';
                                  return (
                                    <div
                                      key={msg.id}
                                      className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div
                                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                          isSelf
                                            ? 'bg-gradient-to-br from-[#a855f7] to-[#3b82f6] text-white rounded-tr-none'
                                            : 'bg-[#181926] border border-white/5 text-[#e5e7eb] rounded-tl-none'
                                        }`}
                                      >
                                        <p className="whitespace-pre-wrap font-light">{msg.text}</p>
                                        <span className="text-[8px] opacity-60 block text-right mt-1.5">
                                          {new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                              <div ref={chatBottomRef} />
                            </div>

                            {/* Message Input Form */}
                            <form
                              onSubmit={handleSendMessage}
                              className="p-3 border-t border-white/5 bg-[#111221]/30 flex gap-2"
                            >
                              <input
                                type="text"
                                placeholder="Écrivez votre message..."
                                value={newMsgText}
                                onChange={(e) => setNewMsgText(e.target.value)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-[#141524] border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all text-xs"
                              />
                              <button
                                type="submit"
                                disabled={sendingMsg || !newMsgText.trim()}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#3b82f6] text-white font-bold flex items-center justify-center disabled:opacity-50 shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-all"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="glass-panel p-20 text-center text-[#9ca3af] font-light">
                      Sélectionnez un abonnement à gauche pour afficher les accès et contacter le support.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-[#060713]">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-[#6b7280] font-light space-y-4">
          <p className="text-sm font-semibold tracking-tight text-white/80">StreamMalin</p>
          <p>
            Service de courtage d&apos;abonnements de streaming partagés. Toutes les marques de commerce appartiennent à leurs propriétaires respectifs.
          </p>
          <p>&copy; {new Date().getFullYear()} StreamMalin. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
