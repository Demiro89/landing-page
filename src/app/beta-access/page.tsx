'use client';

import { useState, useRef, useEffect } from 'react';

export default function BetaAccessPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/beta/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Code incorrect.');
        setCode('');
        inputRef.current?.focus();
        return;
      }
      // Cookie posé server-side — recharger vers l'accueil
      window.location.href = '/';
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Inline theme init — évite le flash même sans layout partagé */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('sm-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
        }}
      />

      {/* Background blobs */}
      <div className="blob blob-red" />
      <div className="blob blob-violet" />

      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 800,
            fontSize: '1.2rem',
            color: 'var(--text)',
            textDecoration: 'none',
            marginBottom: '40px',
          }}
        >
          <span
            style={{
              width: '36px',
              height: '36px',
              background: '#fff',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000',
              fontSize: '0.9rem',
            }}
          >
            <i className="fa-solid fa-bolt" />
          </span>
          StreamMalin
        </a>

        {/* Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'var(--card)',
            border: '1px solid var(--border2)',
            borderRadius: '20px',
            padding: '36px 32px',
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: '999px',
              padding: '5px 14px',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: '#a78bfa',
              marginBottom: '20px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#a78bfa',
                boxShadow: '0 0 6px #a78bfa',
                animation: 'blink 1.8s ease-in-out infinite',
              }}
            />
            Bêta Privée
          </div>

          <h1
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: '1.6rem',
              letterSpacing: '-0.03em',
              marginBottom: '8px',
              lineHeight: 1.2,
            }}
          >
            Accès restreint
          </h1>
          <p
            style={{
              color: 'var(--muted)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              marginBottom: '28px',
            }}
          >
            StreamMalin est actuellement en phase de test privée.
            Entrez votre code d&apos;invitation pour accéder au site.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              placeholder="Code d'accès"
              autoComplete="off"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${error ? 'rgba(255,59,59,0.5)' : 'var(--border2)'}`,
                borderRadius: '10px',
                padding: '13px 16px',
                fontSize: '1rem',
                color: 'var(--text)',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 600,
                letterSpacing: '0.08em',
                outline: 'none',
                textAlign: 'center' as const,
                transition: 'border-color 0.2s',
              }}
            />

            {error && (
              <div
                style={{
                  background: 'rgba(255,59,59,0.08)',
                  border: '1px solid rgba(255,59,59,0.25)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: '#ff6b6b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                <i className="fa-solid fa-triangle-exclamation" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                background: code.trim()
                  ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                  : 'rgba(255,255,255,0.06)',
                color: code.trim() ? '#fff' : 'var(--muted)',
                border: 'none',
                borderRadius: '10px',
                padding: '13px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, color 0.2s, opacity 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                  Vérification...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-unlock" style={{ marginRight: '8px' }} />
                  Accéder au site
                </>
              )}
            </button>
          </form>
        </div>

        <p style={{ marginTop: '28px', fontSize: '0.75rem', color: 'var(--muted)' }}>
          Vous n&apos;avez pas de code ? Contactez-nous sur{' '}
          <a
            href="https://t.me/flexnight9493"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'none' }}
          >
            Telegram
          </a>
          .
        </p>
      </main>
    </>
  );
}
