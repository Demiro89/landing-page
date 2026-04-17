'use client';

import { useState, useEffect, useRef } from 'react';
import CheckoutModal from '@/components/CheckoutModal';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// --------------------------------------
// Types
// --------------------------------------
type Service = 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';
type StockInfo = { available: number; total: number };

// --------------------------------------
// Main Landing Page
// --------------------------------------
export default function HomePage() {
  const [checkoutService, setCheckoutService] = useState<Service | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [stocks, setStocks] = useState<Record<Service, StockInfo> | null>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Waitlist form
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistService, setWaitlistService] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistMsg, setWaitlistMsg] = useState('');

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail || waitlistStatus === 'loading') return;
    setWaitlistStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, service: waitlistService || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaitlistStatus('success');
      } else {
        setWaitlistStatus('error');
        setWaitlistMsg(data.error ?? 'Une erreur est survenue.');
      }
    } catch {
      setWaitlistStatus('error');
      setWaitlistMsg('Impossible de se connecter au serveur.');
    }
  }

  // Fetch available stock
  useEffect(() => {
    fetch('/api/stock')
      .then((r) => r.json())
      .then((d) => setStocks(d))
      .catch(() => { /* silently ignore — badges just won't show */ });
  }, []);

  // Animated counter
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let start = 0;
          const target = 500;
          const duration = 2000;
          const step = target / (duration / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= target) {
              setMemberCount(target);
              clearInterval(timer);
            } else {
              setMemberCount(Math.floor(start));
            }
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
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navbar onSubscribe={(service) => setCheckoutService(service)} />

      {/* == HERO == */}
      <section
        className="hero relative z-10 min-h-screen flex flex-col items-center justify-center text-center"
        style={{ padding: '110px 24px 80px' }}
      >
        <div
          className="live-badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '999px',
            padding: '6px 16px',
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--green)',
            marginBottom: '28px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'var(--green)',
              boxShadow: '0 0 8px var(--green)',
              animation: 'blink 1.8s ease-in-out infinite',
            }}
          />
          Accès instantané après paiement
        </div>

        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(2.1rem, 9vw, 5.5rem)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: '22px',
            maxWidth: '820px',
          }}
        >
          Vos abonnements
          <br />
          <span style={{ color: 'var(--yt)' }}>Premium</span>,<br />
          sans vous <span style={{ color: '#a78bfa' }}>ruiner.</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)',
            color: 'var(--muted)',
            maxWidth: '500px',
            lineHeight: 1.7,
            marginBottom: '40px',
          }}
        >
          YouTube Premium et Disney+ à{' '}
          <strong style={{ color: 'var(--text)' }}>−50%</strong>. Accès instantané, sans
          engagement, support 7j/7.
        </p>

        <button
          className="cta-btn"
          onClick={() => document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <i className="fa-solid fa-bolt" style={{ fontSize: '1.2rem' }} />
          Voir les offres
        </button>

        {/* Stat pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '40px',
          }}
        >
          {[
            { icon: 'fa-users', color: '#3b82f6', text: '500+', label: 'clients satisfaits' },
            { icon: 'fa-star', color: '#f59e0b', text: '4.9/5', label: '' },
            { icon: 'fa-shield-halved', color: 'var(--green)', text: 'Sécurisé', label: '' },
            { icon: 'fa-bolt', color: 'var(--yt)', text: 'en 1 min', label: 'Livraison' },
          ].map((pill, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '999px',
                padding: '8px 16px',
                fontSize: '0.8rem',
                color: 'var(--muted)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <i className={`fa-solid ${pill.icon}`} style={{ color: pill.color }} />
              {pill.label && <span>{pill.label} </span>}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{pill.text}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* == OFFRES == */}
      <section
        id="offres"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '14px',
          }}
        >
          Tarifs
        </p>
        <h2
          className="reveal"
          style={{
            textAlign: 'center',
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '12px',
          }}
        >
          Nos offres
        </h2>
        <p
          className="reveal"
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '0.95rem',
            marginBottom: '52px',
            lineHeight: 1.6,
          }}
        >
          Prix cassés. Qualité officielle. Résiliation à tout moment.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Skeleton cards pendant le chargement du stock */}
          {stocks === null && (
            <>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    padding: '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
                  <div className="skeleton" style={{ width: '60%', height: '18px' }} />
                  <div className="skeleton" style={{ width: '40%', height: '32px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {[80, 90, 75, 85].map((w, j) => (
                      <div key={j} className="skeleton" style={{ width: `${w}%`, height: '12px' }} />
                    ))}
                  </div>
                  <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '12px', marginTop: '8px' }} />
                </div>
              ))}
            </>
          )}

          {/* YouTube Card */}
          {stocks !== null && <>
          <ProductCard
            service="YOUTUBE"
            title="YouTube Premium"
            price="5,99€"
            originalPrice="13,99€/mois"
            savings="-57% d'économie"
            icon="fa-brands fa-youtube"
            accentColor="var(--yt)"
            glowColor="rgba(255,59,59,0.12)"
            borderColor="var(--yt)"
            features={[
              'Zéro publicité, navigation fluide',
              'Mode hors-ligne & téléchargements',
              'YouTube Music inclus',
              'Lecture en arrière-plan',
            ]}
            popular
            stock={stocks['YOUTUBE'] ?? null}
            onSubscribe={() => setCheckoutService('YOUTUBE')}
            delay="d0"
          />

          {/* Disney+ Card */}
          <ProductCard
            service="DISNEY"
            title="Disney+ Premium 4K"
            price="4,99€"
            originalPrice="15,99€/mois"
            savings="-69% d'économie"
            icon="fa-solid fa-wand-magic-sparkles"
            accentColor="#a78bfa"
            glowColor="rgba(124,58,237,0.12)"
            borderColor="var(--dis)"
            features={[
              'Marvel, Star Wars, Pixar, Nat Geo',
              'Qualité 4K HDR Dolby Vision',
              'Profil personnel & privé',
              'Résiliation à tout moment',
            ]}
            stock={stocks['DISNEY'] ?? null}
            onSubscribe={() => setCheckoutService('DISNEY')}
            delay="d1"
          />

          {/* Surfshark VPN Card */}
          <ProductCard
            service="SURFSHARK"
            title="Surfshark VPN One"
            price="2,49€"
            originalPrice="10,99€/mois"
            savings="-77% d'économie"
            icon="fa-solid fa-shield-halved"
            accentColor="#00c7e0"
            glowColor="rgba(0,199,224,0.12)"
            borderColor="#00c7e0"
            features={[
              'VPN illimité + antivirus inclus',
              'Appareils illimités simultanés',
              'Alert & Search inclus',
              'Pas de logs — confidentialité totale',
            ]}
            stock={stocks['SURFSHARK'] ?? null}
            onSubscribe={() => setCheckoutService('SURFSHARK')}
            delay="d2"
          />
          </>}
        </div>

        <div
          className="reveal d2"
          style={{ textAlign: 'center', marginTop: '36px' }}
        >
          <button
            className="cta-btn"
            onClick={() => setCheckoutService('YOUTUBE')}
          >
            <i className="fa-solid fa-bolt" />
            Obtenir mon accès maintenant
          </button>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* == LISTE D'ATTENTE == */}
      <section
        id="waitlist"
        style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto', padding: '72px 24px' }}
      >
        <div
          className="reveal"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderTop: '2px solid #7c3aed',
            borderRadius: '20px',
            padding: '40px 36px',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          {/* Glow */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: '140px',
              background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.14), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Icon badge */}
          <div
            style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'rgba(124,58,237,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', margin: '0 auto 20px',
            }}
          >
            <i className="fa-solid fa-bell" style={{ color: '#a78bfa' }} />
          </div>

          <span
            style={{
              display: 'inline-block',
              background: 'rgba(167,139,250,0.12)',
              color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: '999px',
              padding: '3px 13px',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '18px',
            }}
          >
            Places limitées
          </span>

          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '12px',
            }}
          >
            Plus de places disponibles ?
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '28px', maxWidth: '460px', margin: '0 auto 28px' }}>
            Inscrivez-vous pour être averti dès le prochain réapprovisionnement !<br />
            Vous recevrez un email dès qu&apos;une place se libère.
          </p>

          {waitlistStatus === 'success' ? (
            <div
              style={{
                background: 'rgba(0,255,170,0.08)',
                border: '1px solid rgba(0,255,170,0.25)',
                borderRadius: '12px',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
            >
              <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)', fontSize: '1.2rem' }} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '2px' }}>
                  Vous êtes sur la liste !
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  On vous prévient dès qu&apos;une place se libère.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleWaitlist}>
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginBottom: waitlistStatus === 'error' ? '10px' : '16px',
                }}
              >
                <select
                  value={waitlistService}
                  onChange={(e) => setWaitlistService(e.target.value)}
                  style={{
                    flex: '0 1 200px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border2)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '0.9rem',
                    color: waitlistService ? 'var(--text)' : 'var(--muted)',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238888aa' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '32px',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border2)')}
                >
                  <option value="" disabled style={{ background: '#12121a' }}>Quel service ?</option>
                  <option value="YOUTUBE" style={{ background: '#12121a' }}>▶ YouTube Premium</option>
                  <option value="DISNEY" style={{ background: '#12121a' }}>✦ Disney+ Premium 4K</option>
                  <option value="SURFSHARK" style={{ background: '#12121a' }}>🛡 Surfshark VPN</option>
                </select>
                <input
                  type="email"
                  required
                  placeholder="votre@email.com"
                  value={waitlistEmail}
                  onChange={(e) => { setWaitlistEmail(e.target.value); setWaitlistStatus('idle'); }}
                  style={{
                    flex: '1 1 220px',
                    minWidth: '0',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${waitlistStatus === 'error' ? 'rgba(255,59,59,0.5)' : 'var(--border2)'}`,
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '0.9rem',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = waitlistStatus === 'error' ? 'rgba(255,59,59,0.5)' : 'var(--border2)')}
                />
                <button
                  type="submit"
                  disabled={waitlistStatus === 'loading'}
                  style={{
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 22px',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: waitlistStatus === 'loading' ? 'not-allowed' : 'pointer',
                    opacity: waitlistStatus === 'loading' ? 0.7 : 1,
                    transition: 'opacity 0.2s, transform 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (waitlistStatus !== 'loading') (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                >
                  {waitlistStatus === 'loading' ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" />
                      Inscription…
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane" />
                      S&apos;inscrire
                    </>
                  )}
                </button>
              </div>

              {waitlistStatus === 'error' && (
                <p style={{ fontSize: '0.82rem', color: '#ff6b6b', marginBottom: '12px' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
                  {waitlistMsg}
                </p>
              )}

              <p style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>
                <i className="fa-solid fa-lock" style={{ marginRight: '5px', fontSize: '0.65rem' }} />
                Aucun spam. Désabonnement à tout moment.
              </p>
            </form>
          )}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* == COMMENT ÇA MARCHE == */}
      <section
        id="comment"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '14px',
          }}
        >
          Processus
        </p>
        <h2
          className="reveal"
          style={{
            textAlign: 'center',
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '12px',
          }}
        >
          Comment ça marche ?
        </h2>
        <p
          className="reveal"
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '0.95rem',
            marginBottom: '52px',
            lineHeight: 1.6,
          }}
        >
          3 étapes. Moins d'une minute.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {[
            {
              num: '01',
              title: 'Choisissez votre offre',
              desc: 'Sélectionnez YouTube Premium ou Disney+ sur cette page selon vos besoins et votre budget.',
              delay: '',
            },
            {
              num: '02',
              title: 'Payez discrètement',
              desc: "Par Carte Bancaire (Stripe), PayPal (option \"Entre proches\") ou Crypto. Paiement sécurisé. Vos instructions s'affichent directement sur le site.",
              delay: 'd1',
            },
            {
              num: '03',
              title: 'Accédez à votre espace',
              desc: 'Après validation, votre dashboard affiche vos accès Disney+ en clair ou confirme l\'envoi de l\'invitation YouTube.',
              delay: 'd2',
            },
          ].map((step) => (
            <div
              key={step.num}
              className={`reveal ${step.delay}`}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px 20px',
                transition: 'border-color 0.25s, transform 0.25s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--muted)',
                  marginBottom: '16px',
                }}
              >
                {step.num}
              </div>
              <h4
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '1rem',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}
              >
                {step.title}
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* == RÉASSURANCE == */}
      <section
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '14px',
          }}
        >
          Pourquoi nous choisir ?
        </p>
        <h2
          className="reveal"
          style={{
            textAlign: 'center',
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '12px',
          }}
        >
          Simple, rapide, sécurisé.
        </h2>
        <p
          className="reveal"
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '0.95rem',
            marginBottom: '52px',
          }}
        >
          Tout est pensé pour vous faciliter la vie.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
          }}
        >
          <TrustCard
            iconBg="rgba(255,59,59,0.12)"
            icon="fa-bolt"
            iconColor="var(--yt)"
            title="Livraison instantanée"
            desc="Votre accès est activé en quelques minutes après validation. Pas d'attente inutile."
            delay=""
          />
          <TrustCard
            iconBg="rgba(0,255,170,0.1)"
            icon="fa-lock"
            iconColor="var(--green)"
            title="Paiement sécurisé"
            desc="CB cryptée via Stripe, PayPal discret ou Crypto. Aucun tiers intermédiaire. Vous choisissez."
            delay="d1"
            chips={[
              { icon: 'fa-brands fa-cc-visa', color: '#1a1f71', label: 'Visa' },
              { icon: 'fa-brands fa-cc-mastercard', color: '#eb001b', label: 'Mastercard' },
              { icon: 'fa-brands fa-paypal', color: '#009cde', label: 'PayPal' },
              { icon: 'fa-coins', color: '#f59e0b', label: 'Crypto' },
            ]}
          />
          <TrustCard
            iconBg="rgba(59,130,246,0.12)"
            icon="fa-headset"
            iconColor="#3b82f6"
            title="Support réactif 7j/7"
            desc="Une question ? Notre équipe vous répond directement sur Telegram, tous les jours."
            delay="d2"
          />
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* == TÉMOIGNAGES == */}
      <section
        id="avis"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '80px 24px',
        }}
      >
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: '14px',
          }}
        >
          Avis clients
        </p>
        <h2
          className="reveal"
          style={{
            textAlign: 'center',
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '12px',
          }}
        >
          Ils nous font confiance
        </h2>
        <p
          className="reveal"
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '0.95rem',
            marginBottom: '52px',
          }}
        >
          500+ membres satisfaits. Rejoignez la communauté.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
          }}
        >
          {[
            {
              text: '"J\'ai reçu mes accès YouTube Premium en moins de 5 minutes. Le service est impeccable et le prix est imbattable. Je recommande à 100% !"',
              name: 'Thomas M.',
              role: 'Client depuis 6 mois',
              avatar: 'T',
              avatarBg: 'rgba(255,59,59,0.2)',
              avatarColor: 'var(--yt)',
              delay: '',
            },
            {
              text: '"Disney+ à 4,99€ c\'est ouf. J\'ai essayé d\'autres services avant mais là c\'est le meilleur rapport qualité/prix. Support super réactif aussi."',
              name: 'Sarah K.',
              role: 'Cliente depuis 3 mois',
              avatar: 'S',
              avatarBg: 'rgba(124,58,237,0.2)',
              avatarColor: '#a78bfa',
              delay: 'd1',
            },
            {
              text: '"J\'ai pris les deux abonnements pour moins de 11€/mois. Livraison instantanée, aucun problème depuis le début. Je renouvelle chaque mois sans hésiter."',
              name: 'Alexandre R.',
              role: 'Client depuis 1 an',
              avatar: 'A',
              avatarBg: 'rgba(0,255,170,0.1)',
              avatarColor: 'var(--green)',
              delay: 'd2',
            },
          ].map((t, i) => (
            <div
              key={i}
              className={`reveal ${t.delay}`}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '22px 20px',
                transition: 'transform 0.25s',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.transform = '')
              }
            >
              <div style={{ color: '#f59e0b', fontSize: '0.8rem', marginBottom: '10px' }}>
                {'★★★★★'}
              </div>
              <p
                style={{
                  fontSize: '0.87rem',
                  color: 'var(--muted)',
                  lineHeight: 1.6,
                  marginBottom: '16px',
                }}
              >
                {t.text}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: t.avatarBg,
                    color: t.avatarColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p style={{ fontSize: '0.84rem', fontWeight: 600 }}>{t.name}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      {/* == STATS ANIMÉES == */}
      <section
        ref={statsRef}
        id="stats"
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '50px 24px',
          textAlign: 'center',
        }}
      >
        <h2
          className="reveal"
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: '40px',
          }}
        >
          Ils nous font déjà confiance
        </h2>

        <div
          className="reveal"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '32px',
          }}
        >
          {[
            { value: `${memberCount}+`, label: 'Membres actifs', color: 'var(--yt)' },
            { value: '57%', label: 'Économies moyennes', color: '#a78bfa' },
            { value: '4.9★', label: 'Note moyenne', color: 'var(--green)' },
            { value: '<1min', label: 'Délai livraison', color: '#f59e0b' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: '2.8rem',
                  fontWeight: 800,
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="reveal" style={{ marginTop: '48px' }}>
          <button
            className="cta-btn"
            style={{ fontSize: '1.05rem', padding: '18px 36px' }}
            onClick={() => setCheckoutService('YOUTUBE')}
          >
            <i className="fa-solid fa-bolt" style={{ fontSize: '1.2rem' }} />
            Rejoindre maintenant
          </button>
          <p style={{ marginTop: '16px', fontSize: '0.78rem', color: 'var(--muted)' }}>
            ✅ Sans engagement · 🔒 Paiement sécurisé · ⚡ Accès instantané
          </p>
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--border)', position: 'relative', zIndex: 1 }} />

      <Footer />

      {/* == CHECKOUT MODAL == */}
      {checkoutService && (
        <CheckoutModal
          service={checkoutService}
          onClose={() => setCheckoutService(null)}
        />
      )}
    </>
  );
}

// --------------------------------------
// Sub-components
// --------------------------------------

function ProductCard({
  service,
  title,
  price,
  originalPrice,
  savings,
  icon,
  accentColor,
  glowColor,
  borderColor,
  features,
  popular,
  stock,
  onSubscribe,
  delay,
}: {
  service: Service;
  title: string;
  price: string;
  originalPrice: string;
  savings: string;
  icon: string;
  accentColor: string;
  glowColor: string;
  borderColor: string;
  features: string[];
  popular?: boolean;
  stock: StockInfo | null;
  onSubscribe: () => void;
  delay: string;
}) {
  // stock=null  → data not loaded yet, show nothing
  // total=0     → service has no master accounts, hide badge
  // available=0 → COMPLET
  const isFull = stock !== null && stock.total > 0 && stock.available === 0;
  const showBadge = stock !== null && stock.total > 0 && stock.available > 0;
  const isLast = showBadge && stock.available === 1;

  return (
    <div
      className={`reveal ${delay}`}
      style={{
        background: 'var(--card)',
        border: `1px solid var(--border)`,
        borderTop: `2px solid ${isFull ? '#ff3b3b55' : borderColor}`,
        borderRadius: '20px',
        padding: '28px 24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.25s, border-color 0.25s',
        opacity: 1,
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)'}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.transform = '')}
    >
      {/* Glow top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '130px',
          background: `radial-gradient(ellipse at 50% 0%, ${glowColor}, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Stock badge — top right (replaces "Le plus populaire" when full) */}
      {isFull ? (
        <span
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255,59,59,0.15)',
            color: '#ff3b3b',
            border: '1px solid rgba(255,59,59,0.35)',
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 11px',
            borderRadius: '999px',
          }}
        >
          ● COMPLET
        </span>
      ) : showBadge ? (
        <span
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: isLast ? 'rgba(251,146,60,0.15)' : 'rgba(0,255,170,0.12)',
            color: isLast ? '#fb923c' : 'var(--green)',
            border: `1px solid ${isLast ? 'rgba(251,146,60,0.35)' : 'rgba(0,255,170,0.3)'}`,
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 11px',
            borderRadius: '999px',
          }}
        >
          ● {stock.available} PLACE{stock.available > 1 ? 'S' : ''} DISPO
        </span>
      ) : popular ? (
        <span
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#fff',
            color: '#000',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            padding: '4px 11px',
            borderRadius: '999px',
          }}
        >
          ⭐ Le plus populaire
        </span>
      ) : null}

      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '13px',
          background: glowColor,
          color: accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          marginBottom: '16px',
        }}
      >
        <i className={icon} />
      </div>

      <h3
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '1.15rem',
          fontWeight: 700,
          marginBottom: '8px',
        }}
      >
        {title}
      </h3>

      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '2.2rem',
          fontWeight: 800,
          lineHeight: 1,
          marginBottom: '4px',
        }}
      >
        {price}
        <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--muted)' }}>
          /mois
        </span>
      </div>

      <p
        style={{
          fontSize: '0.78rem',
          color: 'var(--muted)',
          textDecoration: 'line-through',
          marginBottom: '6px',
        }}
      >
        Prix officiel : {originalPrice}
      </p>

      <span
        style={{
          display: 'inline-block',
          background: 'rgba(0,255,170,0.12)',
          color: 'var(--green)',
          border: '1px solid rgba(0,255,170,0.25)',
          borderRadius: '999px',
          padding: '2px 10px',
          fontSize: '0.7rem',
          fontWeight: 700,
          marginBottom: '18px',
        }}
      >
        {savings}
      </span>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 22px',
          borderTop: '1px solid var(--border)',
          paddingTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {features.map((f, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--muted)',
              fontSize: '0.88rem',
            }}
          >
            <i
              className="fa-solid fa-circle-check"
              style={{ fontSize: '0.72rem', color: accentColor, flexShrink: 0 }}
            />
            {f}
          </li>
        ))}
      </ul>

      {isFull ? (
        <button
          onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '0.92rem',
            padding: '13px',
            borderRadius: '11px',
            cursor: 'pointer',
            border: '1px solid rgba(167,139,250,0.4)',
            background: 'rgba(124,58,237,0.12)',
            color: '#a78bfa',
            transition: 'background 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.22)';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.12)';
            (e.currentTarget as HTMLButtonElement).style.transform = '';
          }}
        >
          <i className="fa-solid fa-bell" style={{ marginRight: '8px' }} />
          Me prévenir du retour
        </button>
      ) : (
        <button
          onClick={onSubscribe}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '0.92rem',
            padding: '13px',
            borderRadius: '11px',
            cursor: 'pointer',
            border: 'none',
            background: service === 'YOUTUBE'
              ? 'var(--yt)'
              : service === 'DISNEY'
              ? 'linear-gradient(135deg, #2563eb, #7c3aed)'
              : 'linear-gradient(135deg, #0891b2, #00c7e0)',
            color: '#fff',
            transition: 'opacity 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            (e.currentTarget as HTMLButtonElement).style.transform = '';
          }}
        >
          <i className="fa-solid fa-bolt" style={{ marginRight: '8px' }} />
          S&apos;abonner maintenant
        </button>
      )}
    </div>
  );
}

function TrustCard({
  iconBg,
  icon,
  iconColor,
  title,
  desc,
  delay,
  chips,
}: {
  iconBg: string;
  icon: string;
  iconColor: string;
  title: string;
  desc: string;
  delay: string;
  chips?: { icon: string; color: string; label: string }[];
}) {
  return (
    <div
      className={`reveal ${delay}`}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '22px 20px',
        textAlign: 'center',
        transition: 'border-color 0.25s, transform 0.25s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform = '';
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.3rem',
          margin: '0 auto 14px',
        }}
      >
        <i className={`fa-solid ${icon}`} style={{ color: iconColor }} />
      </div>
      <h3
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '1rem',
          fontWeight: 700,
          marginBottom: '8px',
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: chips ? '12px' : 0 }}>
        {desc}
      </p>
      {chips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '7px' }}>
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '7px',
                padding: '5px 11px',
                fontSize: '0.76rem',
                color: 'var(--muted)',
              }}
            >
              <i className={c.icon} style={{ color: c.color }} /> {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
