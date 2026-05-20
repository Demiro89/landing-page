'use client';

import Icon from '@/components/Icon';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const CheckoutModal = dynamic(() => import('@/components/CheckoutModal'), { ssr: false });

type Service = 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';
type StockInfo = { available: number; total: number };

const SERVICES = [
  {
    id: 'YOUTUBE' as Service,
    name: 'YouTube Premium',
    tagline: 'Musique et vidéos sans pub, en arrière-plan',
    price: '5,99€',
    original: '13,99€',
    savings: '-57%',
    savingsAmt: '-8,00€',
    gradient: 'var(--gradient-yt)',
    bannerClass: 'banner-yt',
    accentColor: 'var(--yt)',
    glowColor: 'rgba(255,59,59,0.12)',
    icon: 'fa-brands fa-youtube',
    features: [
      'Zéro publicité, navigation fluide',
      'Mode hors-ligne & téléchargements',
      'YouTube Music inclus',
      'Lecture en arrière-plan',
      'Accès immédiat après achat',
    ],
  },
  {
    id: 'DISNEY' as Service,
    name: 'Disney+ Premium 4K',
    tagline: 'Marvel, Star Wars, Pixar en qualité 4K HDR',
    price: '4,99€',
    original: '15,99€',
    savings: '-69%',
    savingsAmt: '-11,00€',
    gradient: 'var(--gradient-disney)',
    bannerClass: 'banner-disney',
    accentColor: '#a78bfa',
    glowColor: 'rgba(124,58,237,0.12)',
    icon: 'fa-solid fa-wand-magic-sparkles',
    features: [
      'Marvel, Star Wars, Pixar, Nat Geo',
      'Qualité 4K HDR Dolby Vision',
      'Profil personnel & privé',
      'Résiliation à tout moment',
      'Accès immédiat après achat',
    ],
  },
  {
    id: 'SURFSHARK' as Service,
    name: 'Surfshark VPN One',
    tagline: 'Navigation ultra-sécurisée, appareils illimités',
    price: '2,49€',
    original: '10,99€',
    savings: '-77%',
    savingsAmt: '-8,50€',
    gradient: 'var(--gradient-surfshark)',
    bannerClass: 'banner-surfshark',
    accentColor: 'var(--surf)',
    glowColor: 'rgba(0,199,224,0.12)',
    icon: 'fa-solid fa-shield-halved',
    features: [
      'VPN illimité + antivirus inclus',
      'Appareils illimités simultanés',
      'Alert & Search inclus',
      'Pas de logs — confidentialité totale',
      'Accès immédiat après achat',
    ],
  },
] as const;

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionne StreamMalin ?',
    a: "StreamMalin propose des accès à des abonnements groupés officiels YouTube Premium, Disney+ et Surfshark à prix réduit. Après paiement, vous recevez vos identifiants ou votre lien d'invitation directement dans votre espace client.",
  },
  {
    q: 'Le service est-il légal et sécurisé ?',
    a: "Oui. Les abonnements familiaux et multi-profils sont officiellement conçus pour être utilisés sur plusieurs comptes. Vos données personnelles sont privées et vous disposez de votre propre profil.",
  },
  {
    q: 'Y a-t-il un engagement de durée ?',
    a: "Aucun engagement. Vous choisissez la durée (1, 3, 6 ou 12 mois) et pouvez ne pas renouveler à l'échéance. Aucun prélèvement automatique.",
  },
  {
    q: "Que se passe-t-il si un accès cesse de fonctionner ?",
    a: "Notre équipe intervient sous 24h pour rétablir votre accès ou vous proposer un remplacement. Si aucune solution n'est trouvée, vous êtes remboursé au prorata.",
  },
  {
    q: 'Comment contacter le support ?',
    a: "Par email à hello@streammalin.fr ou directement sur Telegram (@flexnight9493). Nous répondons 7j/7.",
  },
];

export default function HomePage() {
  const [checkoutService, setCheckoutService] = useState<Service | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [stocks, setStocks] = useState<Record<Service, StockInfo> | null>(null);
  const [activeFilter, setActiveFilter] = useState<Service | 'all'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/stock')
      .then((r) => r.json())
      .then((d) => setStocks(d))
      .catch(() => {});
  }, []);

  // Animated counter
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let start = 0;
          const target = 500;
          const step = target / (2000 / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= target) { setMemberCount(target); clearInterval(timer); }
            else setMemberCount(Math.floor(start));
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const filteredServices = activeFilter === 'all'
    ? SERVICES
    : SERVICES.filter((s) => s.id === activeFilter);

  return (
    <>
      <Navbar onSubscribe={(s) => setCheckoutService(s)} />

      {/* ═══════════ HERO ═══════════ */}
      <section
        className="hero"
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '110px 24px 80px',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glows */}
        <div style={{
          position: 'absolute', top: '5%', left: '-8%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 65%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '0%', right: '-8%', width: '45vw', height: '45vw',
          background: 'radial-gradient(circle, rgba(0,199,224,0.06) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        {/* Live badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '999px', padding: '6px 18px', fontSize: '0.72rem',
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)',
          marginBottom: '28px', backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--green)', boxShadow: '0 0 8px var(--green)',
            animation: 'blink 1.8s ease-in-out infinite',
          }} />
          Accès instantané après paiement
        </div>

        <h1 style={{
          fontFamily: 'var(--font-syne), sans-serif',
          fontSize: 'clamp(2.2rem, 9vw, 5.5rem)',
          fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em',
          marginBottom: '22px', maxWidth: '860px', position: 'relative',
        }}>
          Divisez vos factures de{' '}
          <span className="gradient-text">streaming</span>{' '}
          par 4
        </h1>

        <p style={{
          fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)', color: 'var(--muted)',
          maxWidth: '520px', lineHeight: 1.7, marginBottom: '40px',
        }}>
          YouTube Premium, Disney+ et Surfshark à{' '}
          <strong style={{ color: 'var(--text)' }}>prix cassé</strong>. Accès officiel,
          livraison instantanée, support 7j/7.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '48px' }}>
          <button
            className="cta-btn"
            onClick={() => document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Icon className="fa-solid fa-bolt" style={{ fontSize: '1.1rem' }} />
            Voir les offres
          </button>
          <button
            onClick={() => document.getElementById('comparateur')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--muted)', fontWeight: 600, fontSize: '0.93rem',
              padding: '14px 28px', borderRadius: '12px', cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
            }}
          >
            <Icon className="fa-solid fa-chart-bar" />
            Comparer les prix
          </button>
        </div>

        {/* Trust badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
          {[
            { icon: 'fa-lock', color: 'var(--green)', label: 'Paiement 3D Secure' },
            { icon: 'fa-bolt', color: 'var(--yt)', label: 'Accès immédiat' },
            { icon: 'fa-shield-halved', color: '#a78bfa', label: 'Garantie remboursement' },
            { icon: 'fa-headset', color: 'var(--surf)', label: 'Support 7j/7' },
          ].map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '999px', padding: '8px 16px',
              fontSize: '0.8rem', color: 'var(--muted)', backdropFilter: 'blur(6px)',
            }}>
              <Icon className={`fa-solid ${b.icon}`} style={{ color: b.color }} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ CATALOGUE ═══════════ */}
      <section id="offres" style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            Tarifs
          </p>
          <h2 className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Nos <span className="gradient-text">Services Premium</span>
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: 1.6 }}>
            Choisissez le service qui vous intéresse et accédez en quelques secondes.
          </p>

          {/* Filter buttons */}
          <div className="reveal" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '40px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tous les services' },
              { id: 'YOUTUBE', label: 'YouTube Premium' },
              { id: 'DISNEY', label: 'Disney Plus' },
              { id: 'SURFSHARK', label: 'Surfshark VPN' },
            ].map((f) => (
              <button
                key={f.id}
                className={`filter-btn${activeFilter === f.id ? ' active' : ''}`}
                onClick={() => setActiveFilter(f.id as Service | 'all')}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {filteredServices.map((svc) => {
              const stock = stocks?.[svc.id] ?? null;
              const isFull = stock !== null && stock.total > 0 && stock.available === 0;
              const showBadge = stock !== null && stock.total > 0 && stock.available > 0;
              const isLast = showBadge && stock.available === 1;

              return (
                <div
                  key={svc.id}
                  className="glass-panel reveal"
                  style={{
                    overflow: 'hidden',
                    transition: 'transform 0.3s, border-color 0.3s',
                    opacity: isFull ? 0.72 : 1,
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => !isFull && ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = '')}
                >
                  {/* Banner */}
                  <div
                    className={svc.bannerClass}
                    style={{
                      height: '130px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', position: 'relative',
                      borderBottom: '1px solid var(--glass-border)',
                    }}
                  >
                    <div style={{
                      position: 'absolute', width: '130px', height: '130px',
                      borderRadius: '50%', background: svc.accentColor,
                      filter: 'blur(50px)', opacity: 0.3, pointerEvents: 'none',
                    }} />
                    <div style={{
                      fontFamily: 'var(--font-syne), sans-serif', fontSize: '1.9rem',
                      fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px',
                      color: svc.accentColor, textShadow: `0 0 25px ${svc.accentColor}99`,
                      position: 'relative', zIndex: 1,
                    }}>
                      <Icon className={svc.icon} style={{ fontSize: '1.7rem' }} />
                      {svc.name}
                    </div>
                    {/* Stock badge */}
                    {isFull ? (
                      <span style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: 'rgba(255,59,59,0.15)', color: 'var(--yt)',
                        border: '1px solid rgba(255,59,59,0.35)',
                        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em',
                        padding: '4px 10px', borderRadius: '999px', textTransform: 'uppercase',
                      }}>● COMPLET</span>
                    ) : showBadge ? (
                      <span style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: isLast ? 'rgba(251,146,60,0.15)' : 'rgba(0,255,170,0.12)',
                        color: isLast ? '#fb923c' : 'var(--green)',
                        border: `1px solid ${isLast ? 'rgba(251,146,60,0.35)' : 'rgba(0,255,170,0.3)'}`,
                        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em',
                        padding: '4px 10px', borderRadius: '999px', textTransform: 'uppercase',
                      }}>● {stock.available} PLACE{stock.available > 1 ? 'S' : ''} DISPO</span>
                    ) : (
                      <span style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: '#fff', color: '#000',
                        fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.05em',
                        padding: '4px 10px', borderRadius: '999px',
                      }}>⭐ Populaire</span>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '24px' }}>
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '18px', fontWeight: 300 }}>
                      {svc.tagline}
                    </p>

                    {/* Price */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: svc.accentColor }}>
                        {svc.price}
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem', paddingBottom: '3px' }}>/mois</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem', textDecoration: 'line-through', marginLeft: 'auto', paddingBottom: '3px' }}>
                        {svc.original}
                      </span>
                      <span style={{
                        background: 'rgba(0,255,170,0.10)', color: 'var(--green)',
                        border: '1px solid rgba(0,255,170,0.2)',
                        borderRadius: '999px', padding: '2px 9px',
                        fontSize: '0.72rem', fontWeight: 700, paddingBottom: '4px',
                      }}>
                        {svc.savings}
                      </span>
                    </div>

                    {/* Features */}
                    <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 22px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {svc.features.map((f, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--muted)', fontSize: '0.87rem' }}>
                          <Icon className="fa-solid fa-circle-check" style={{ fontSize: '0.7rem', color: svc.accentColor, flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => !isFull && setCheckoutService(svc.id)}
                      disabled={isFull}
                      style={{
                        display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: isFull ? 'rgba(255,59,59,0.12)' : svc.gradient,
                        color: isFull ? 'var(--yt)' : '#fff',
                        fontFamily: 'var(--font-syne), sans-serif', fontWeight: 700, fontSize: '0.92rem',
                        padding: '13px', borderRadius: '11px', border: 'none',
                        cursor: isFull ? 'not-allowed' : 'pointer',
                        transition: 'opacity 0.2s, transform 0.2s',
                        boxShadow: isFull ? 'none' : `0 4px 20px ${svc.glowColor}`,
                      }}
                      onMouseEnter={(e) => { if (!isFull) { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                    >
                      {isFull ? (
                        <><Icon className="fa-solid fa-lock" /> COMPLET</>
                      ) : (
                        <><Icon className="fa-solid fa-bolt" /> S'abonner maintenant</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="reveal" style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)', opacity: 0.6, marginTop: '28px', lineHeight: 1.6, maxWidth: '600px', margin: '28px auto 0' }}>
            StreamMalin n&apos;est pas affilié aux plateformes YouTube, Google, Disney+, Surfshark ou autres services mentionnés.
            L&apos;accès peut dépendre des règles techniques et contractuelles imposées par ces plateformes.
          </p>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ COMPARATEUR ═══════════ */}
      <section id="comparateur" style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            Pourquoi payer le prix fort ?
          </p>
          <h2 className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '40px' }}>
            Comparez les <span className="gradient-text">tarifs</span>
          </h2>

          <div className="reveal glass-panel" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '16px 28px', borderBottom: '1px solid var(--glass-border)',
              fontFamily: 'var(--font-syne), sans-serif', fontSize: '0.8rem',
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)',
            }}>
              <div>Service</div>
              <div style={{ textAlign: 'center' }}>Prix officiel</div>
              <div style={{ textAlign: 'center', color: 'hsl(190,95%,50%)' }}>StreamMalin</div>
              <div style={{ textAlign: 'center', color: 'var(--green)' }}>Économie</div>
            </div>

            {SERVICES.map((svc, i) => (
              <div key={svc.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                padding: '20px 28px', alignItems: 'center',
                borderBottom: i < SERVICES.length - 1 ? '1px solid var(--glass-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                  <span style={{ width: '36px', height: '36px', borderRadius: '9px', background: svc.glowColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: svc.accentColor, flexShrink: 0 }}>
                    <Icon className={svc.icon} />
                  </span>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.95rem' }}>{svc.name}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 300, marginTop: '2px' }}>{svc.tagline}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 500, textDecoration: 'line-through', color: 'var(--muted)', fontSize: '0.92rem' }}>{svc.original}/mois</div>
                <div style={{ textAlign: 'center', fontWeight: 800, color: svc.accentColor, fontSize: '1.15rem', fontFamily: 'var(--font-syne), sans-serif' }}>{svc.price}/mois</div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    background: 'rgba(0,255,170,0.08)', color: 'var(--green)',
                    padding: '5px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700,
                    border: '1px solid rgba(0,255,170,0.2)', whiteSpace: 'nowrap',
                  }}>{svc.savings} ({svc.savingsAmt}/m)</span>
                </div>
              </div>
            ))}

            {/* Total row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '20px 28px', alignItems: 'center',
              background: 'rgba(255,255,255,0.02)',
              borderTop: '1px dashed rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                🚀 Cumul des 3 abonnements
              </div>
              <div style={{ textAlign: 'center', fontWeight: 500, textDecoration: 'line-through', color: 'var(--muted)' }}>40,97€/mois</div>
              <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-syne), sans-serif' }}>
                <span className="gradient-text">13,47€/mois</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  background: 'var(--gradient-primary)', color: '#fff',
                  padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}>-67% (-27,50€/m)</span>
              </div>
            </div>
          </div>

          <div className="reveal" style={{ textAlign: 'center', marginTop: '36px' }}>
            <button className="cta-btn" onClick={() => setCheckoutService('YOUTUBE')}>
              <Icon className="fa-solid fa-bolt" />
              Choisir mes abonnements
            </button>
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ COMMENT ÇA MARCHE ═══════════ */}
      <section id="comment" style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            Processus
          </p>
          <h2 className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Comment ça <span className="gradient-text">marche</span> ?
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '52px', lineHeight: 1.6 }}>
            3 étapes. Moins d&apos;une minute. Accès instantané.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {[
              { num: 1, title: 'Sélectionnez une offre', desc: 'Parcourez notre catalogue et choisissez YouTube Premium, Disney+ ou Surfshark selon vos besoins.', icon: 'fa-layer-group' },
              { num: 2, title: 'Réglez en sécurité', desc: 'Payez par carte bancaire (Stripe) ou PayPal Biens & Services. Chiffrement SSL, aucun risque.', icon: 'fa-lock' },
              { num: 3, title: 'Accédez instantanément', desc: 'Vos identifiants ou votre lien d\'invitation apparaissent dans votre espace client en quelques minutes.', icon: 'fa-bolt' },
            ].map((step, i) => (
              <div
                key={i}
                className="reveal glass-panel"
                style={{ padding: '28px 24px', transition: 'transform 0.3s', textAlign: 'center' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = '')}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-syne), sans-serif', fontSize: '1.35rem', fontWeight: 800, color: '#fff',
                  margin: '0 auto 20px',
                  boxShadow: '0 8px 25px rgba(138,92,247,0.3)',
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.87rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ GARANTIES ═══════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            Pourquoi nous choisir ?
          </p>
          <h2 className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Partagez en toute <span className="gradient-text">sérénité</span>
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '52px' }}>
            Sécurité et qualité garanties à chaque commande.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {[
              { icon: 'fa-shield-halved', color: '#a78bfa', bg: 'rgba(124,58,237,0.12)', title: 'Protection Acheteur', desc: 'Remplacement ou remboursement immédiat si votre accès présente un défaut.' },
              { icon: 'fa-lock', color: 'var(--green)', bg: 'rgba(0,255,170,0.08)', title: 'Identifiants Chiffrés', desc: 'Vos mots de passe et liens sont transmis de façon sécurisée, jamais stockés en clair.' },
              { icon: 'fa-bolt', color: 'var(--yt)', bg: 'rgba(255,59,59,0.1)', title: 'Livraison Flash', desc: 'Votre accès Premium est disponible dès la confirmation de la transaction.' },
              { icon: 'fa-headset', color: 'var(--surf)', bg: 'rgba(0,199,224,0.1)', title: 'Support 7j/7', desc: 'Une équipe disponible 7j/7 sur Telegram et par email pour résoudre tout problème.' },
            ].map((g, i) => (
              <div
                key={i}
                className="reveal"
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                  borderRadius: '16px', padding: '26px 20px', textAlign: 'center',
                  transition: 'transform 0.25s, background 0.25s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                }}
              >
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.35rem', margin: '0 auto 14px',
                }}>
                  <Icon className={`fa-solid ${g.icon}`} style={{ color: g.color }} />
                </div>
                <h4 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>{g.title}</h4>
                <p style={{ fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.6 }}>{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ AVIS ═══════════ */}
      <section id="avis" style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            Avis clients
          </p>
          <h2 className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Ils nous font <span className="gradient-text">confiance</span>
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '52px' }}>
            500+ membres satisfaits. Rejoignez la communauté.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {[
              { text: '"J\'ai reçu mes accès YouTube Premium en moins de 5 minutes. Le service est impeccable et le prix est imbattable. Je recommande à 100% !"', name: 'Thomas M.', role: 'Client depuis 6 mois', avatar: 'T', color: 'var(--yt)', bg: 'rgba(255,59,59,0.15)' },
              { text: '"Disney+ à 4,99€ c\'est ouf. J\'ai essayé d\'autres services avant mais là c\'est le meilleur rapport qualité/prix. Support super réactif aussi."', name: 'Sarah K.', role: 'Cliente depuis 3 mois', avatar: 'S', color: '#a78bfa', bg: 'rgba(124,58,237,0.15)' },
              { text: '"J\'ai pris les deux abonnements pour moins de 11€/mois. Livraison instantanée, aucun problème depuis le début. Je renouvelle chaque mois sans hésiter."', name: 'Alexandre R.', role: 'Client depuis 1 an', avatar: 'A', color: 'var(--green)', bg: 'rgba(0,255,170,0.1)' },
            ].map((t, i) => (
              <div
                key={i}
                className="reveal glass-panel"
                style={{ padding: '24px 22px', transition: 'transform 0.3s' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = '')}
              >
                <div style={{ color: '#f59e0b', fontSize: '0.85rem', marginBottom: '12px', letterSpacing: '2px' }}>★★★★★</div>
                <p style={{ fontSize: '0.87rem', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '18px' }}>{t.text}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.name}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ STATS ═══════════ */}
      <section
        ref={statsRef}
        id="stats"
        style={{ position: 'relative', zIndex: 1, padding: '60px 24px', textAlign: 'center' }}
      >
        <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '40px', maxWidth: '800px', margin: '0 auto' }}>
          {[
            { value: `${memberCount}+`, label: 'Membres actifs', color: 'var(--yt)' },
            { value: '67%', label: 'Économies moyennes', color: '#a78bfa' },
            { value: '4.9★', label: 'Note moyenne', color: 'var(--green)' },
            { value: '<1 min', label: 'Délai de livraison', color: 'var(--surf)' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center', minWidth: '120px' }}>
              <div style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: '2.8rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
            FAQ
          </p>
          <h2 className="reveal" style={{ textAlign: 'center', fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '8px' }}>
            Questions <span className="gradient-text">fréquentes</span>
          </h2>
          <p className="reveal" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.95rem', marginBottom: '48px' }}>
            Tout ce que vous devez savoir avant de vous abonner.
          </p>

          <div className="reveal" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className={`faq-item${openFaq === i ? ' open' : ''}`}
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{item.q}</span>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            background: 'var(--gradient-primary)',
            borderRadius: '28px', padding: '64px 48px', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(138,92,247,0.35)',
          }}>
            <div style={{
              position: 'absolute', top: '-40%', right: '-15%',
              width: '400px', height: '400px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 60%)',
              pointerEvents: 'none',
            }} />
            <h2 style={{ fontFamily: 'var(--font-syne), sans-serif', fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 900, marginBottom: '16px', position: 'relative' }}>
              Prêt à réduire vos factures dès aujourd&apos;hui ?
            </h2>
            <p style={{ fontSize: '1.05rem', opacity: 0.9, marginBottom: '36px', maxWidth: '560px', margin: '0 auto 36px', fontWeight: 300, position: 'relative' }}>
              Accès instantané, résiliable à tout moment, sans engagement.
            </p>
            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
              {SERVICES.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => setCheckoutService(svc.id)}
                  style={{
                    background: 'rgba(255,255,255,0.15)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(8px)',
                    fontFamily: 'var(--font-syne), sans-serif', fontWeight: 700,
                    fontSize: '0.88rem', padding: '12px 22px', borderRadius: '10px',
                    cursor: 'pointer', transition: 'background 0.2s, transform 0.2s',
                    display: 'flex', alignItems: 'center', gap: '7px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
                    (e.currentTarget as HTMLButtonElement).style.transform = '';
                  }}
                >
                  <Icon className={svc.icon} />
                  {svc.name} — dès {svc.price}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {checkoutService && (
        <CheckoutModal service={checkoutService} onClose={() => setCheckoutService(null)} />
      )}
    </>
  );
}
