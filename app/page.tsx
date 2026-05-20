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
          <div className="md:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-3" style={{ background: 'hsla(240,24%,5%,0.95)' }}>
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
                STREAMING PREMIUM · LIVRAISON INSTANTANÉE
              </div>
              <h1>
                Le streaming premium,<br />
                <span className="gradient-text">version maline.</span>
              </h1>
              <p className="hero-subtitle">
                Vos abonnements favoris à prix coûtant avec des remises jusqu&apos;à <strong style={{ color: '#fff' }}>75%</strong> grâce à nos places partagées 100% officielles et sécurisées.
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
                <span><span className="check">✓</span> Support 24/7 par Chat</span>
                <span><span className="check">✓</span> Livraison instantanée</span>
                <span><span className="check">✓</span> Sans engagement</span>
                <span><span className="check">✓</span> Paiement sécurisé</span>
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
                <p className="section-subtitle">Sélectionnez votre service. Les accès sécurisés sont envoyés immédiatement après validation du paiement.</p>
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
                            ✗ Rupture de stock
                          </button>
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
          <section id="marketplace" className="section section-alt">
            <div className="section-inner">
              <div className="section-head">
                <div className="section-eyebrow">— Marketplace en direct —</div>
                <h2 className="section-title">
                  Places <span className="gradient-text">disponibles maintenant</span>
                </h2>
                <p className="section-subtitle">Vos accès sont gérés en direct par notre équipe et garantis sans coupure.</p>
              </div>

              <div className="shares-list fade-in-up-stagger">
                {filteredStocks.length === 0 ? (
                  <div className="glass-panel p-12 text-center" style={{ borderRadius: 'var(--radius)', color: 'var(--text-gray)', fontWeight: 400 }}>
                    Aucun accès disponible en stock actuellement pour ce service. Notre équipe réapprovisionne régulièrement, revenez d&apos;ici quelques minutes !
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
                          <div className="share-tag">🛡️ Accès Officiel · Stable &amp; Garanti</div>
                          <div className="share-slots">
                            <span className="slots-label">{avSlots} place{avSlots > 1 ? 's' : ''} libre{avSlots > 1 ? 's' : ''}</span>
                            <div className="share-dots">
                              {slotDots(stock.maxSlots, stock.filledSlots)}
                            </div>
                          </div>
                        </div>
                        <div className="share-price">
                          <span className="price-val">{stock.price.toFixed(2)}€</span>
                          <span className="price-sub">/mois tout inclus</span>
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
                <p className="section-subtitle">Comparez les tarifs officiels avec les prix réduits exclusifs de StreamMalin.</p>
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
                  <div className="calc-result">
                    <div className="calc-tile">
                      <div className="calc-tile-label">Tarif public</div>
                      <div className="calc-tile-value" style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{calcOriginal.toFixed(2)}€</div>
                    </div>
                    <div className="calc-tile" style={{ background: 'linear-gradient(135deg, rgba(138,92,247,0.1), rgba(0,210,255,0.05))', borderColor: 'rgba(138,92,247,0.25)' }}>
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
                      🚀 Sur l&apos;année, vous économisez{' '}
                      <strong className="gradient-text" style={{ fontSize: '1.05rem' }}>{(calcSavings * 12).toFixed(0)}€</strong> !
                    </p>
                    <a href="#offres" className="btn btn-primary btn-sm">
                      🔥 Choisir mes abonnements
                    </a>
                  </div>
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
                  { n: '2', title: 'Réglez en sécurité', text: 'Payez chaque mois par carte bancaire, PayPal (Biens & Services) ou cryptomonnaies. Transactions 100% sécurisées.' },
                  { n: '3', title: 'Accédez instantanément', text: 'Récupérez les identifiants ou le lien d\'invitation directement dans votre Espace Client et profitez immédiatement.' },
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
                <p className="section-subtitle">Sécurité renforcée et conformité légale garanties à 100%.</p>
              </div>
              <div className="guarantees-grid fade-in-up-stagger">
                {[
                  { icon: '🛡️', title: 'Protection Acheteur', text: 'Remplacement ou remboursement immédiat si le compte partagé présente un défaut.' },
                  { icon: '🔐', title: 'Identifiants Chiffrés', text: 'Vos mots de passe et liens de connexion sont cryptés avec la norme AES-256.' },
                  { icon: '⚡', title: 'Livraison Flash', text: 'Pas d\'attente. Votre accès Premium est disponible dès la confirmation de la transaction.' },
                  { icon: '💬', title: 'Support 7j/7', text: 'Une équipe dédiée en français disponible pour résoudre tout conflit ou question.' },
                ].map((g, i) => (
                  <div key={i} className="guarantee-card glass-panel">
                    <div className="guarantee-icon">{g.icon}</div>
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
                <p className="section-subtitle">Toutes les réponses à vos interrogations.</p>
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
                <h2>Prêt à réduire vos factures dès <span className="gradient-text">aujourd&apos;hui</span> ?</h2>
                <p>Rejoignez nos clients économes. Accès instantané, résiliable à tout moment, sans engagement.</p>
                <div className="cta-buttons">
                  <a href="#offres" onClick={() => setFilter('streaming')} className="btn btn-primary">▶ YouTube — dès 3,49€</a>
                  <a href="#offres" onClick={() => setFilter('streaming')} className="btn btn-outline">✦ Disney+ — dès 2,99€</a>
                  <a href="#offres" onClick={() => setFilter('securite')} className="btn btn-outline">🦈 Surfshark — dès 1,49€</a>
                </div>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer style={{ padding: '40px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="nav-logo" style={{ justifyContent: 'center', marginBottom: 12 }}>
              <div className="nav-logo-icon">SM</div>
              <span className="gradient-text">StreamMalin</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              © {new Date().getFullYear()} StreamMalin — Le streaming premium, version maline.
            </p>
          </footer>
        </main>
      )}

      {/* ======================== DASHBOARD CLIENT ======================== */}
      {view === 'dashboard' && (
        <main style={{ paddingTop: 110, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: 'relative', minHeight: '100vh' }}>
          {/* Ambient glow */}
          <div style={{ position: 'absolute', top: 80, left: '-10%', width: '50%', height: 400, borderRadius: '50%', background: 'radial-gradient(circle, hsla(262,88%,64%,0.18), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: 200, right: '-10%', width: '40%', height: 350, borderRadius: '50%', background: 'radial-gradient(circle, hsla(190,95%,50%,0.12), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* Header */}
            <div className="fade-in-up" style={{ marginBottom: 36 }}>
              <div className="hero-badge" style={{ marginBottom: 18 }}>
                <span className="hero-badge-dot" />
                ESPACE CLIENT SÉCURISÉ
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 10 }}>
                    Bienvenue dans votre <span className="gradient-text">espace client</span>
                  </h1>
                  <p style={{ color: 'var(--text-gray)', fontSize: '0.95rem', maxWidth: 560 }}>
                    Gérez vos abonnements et discutez en direct avec notre équipe support.
                  </p>
                </div>
                <button onClick={() => setView('storefront')} className="btn btn-outline btn-sm">
                  ← Retour à la boutique
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Sidebar */}
              <aside className="md:col-span-3 glass-panel rounded-2xl p-4 h-fit">
                <div className="space-y-1">
                  {([['orders', '📦', 'Mes Abonnements'], ['chat', '💬', 'Support Client']] as [DashTab, string, string][]).map(([tab, icon, label]) => (
                    <button
                      key={tab}
                      onClick={() => setDashTab(tab)}
                      className={`dash-sidebar-btn ${dashTab === tab ? 'active' : ''}`}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{icon}</span> {label}
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

    </div>
  );
}
