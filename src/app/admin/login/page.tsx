'use client';

import Icon from '@/components/Icon';
import { useState, useRef } from 'react';

export default function AdminLoginPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = inputRef.current?.value ?? '';
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Erreur');

      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glows */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-10%',
          width: '55vw',
          height: '55vw',
          background: 'radial-gradient(circle, rgba(0,199,224,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="glass-panel"
        style={{
          padding: '44px 36px',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Icône avec gradient */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            color: '#fff',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(138,92,247,0.4)',
          }}
        >
          <Icon className="fa-solid fa-shield-halved" />
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-syne), sans-serif',
            fontSize: '1.45rem',
            fontWeight: 800,
            marginBottom: '6px',
          }}
        >
          Admin <span className="gradient-text">StreamMalin</span>
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '30px', lineHeight: 1.5 }}>
          Entrez votre mot de passe pour accéder au panneau d&apos;administration.
        </p>

        <input
          ref={inputRef}
          type="password"
          placeholder="Mot de passe..."
          required
          autoFocus
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            padding: '13px 15px',
            fontSize: '0.92rem',
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'monospace',
            marginBottom: '14px',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(138,92,247,0.5)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--glass-border)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          }}
        />

        {error && (
          <div
            style={{
              background: 'rgba(255,59,59,0.08)',
              border: '1px solid rgba(255,59,59,0.3)',
              borderRadius: '9px',
              padding: '11px 14px',
              fontSize: '0.82rem',
              color: '#ff6b6b',
              marginBottom: '14px',
              textAlign: 'left',
            }}
          >
            <Icon className="fa-solid fa-triangle-exclamation" style={{ marginRight: '7px' }} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? 'rgba(124,58,237,0.4)' : 'var(--gradient-primary)',
            color: '#fff',
            fontFamily: 'var(--font-syne), sans-serif',
            fontWeight: 700,
            fontSize: '0.95rem',
            padding: '14px',
            borderRadius: '11px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s, transform 0.2s',
            boxShadow: loading ? 'none' : '0 6px 18px rgba(138,92,247,0.35)',
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          {loading ? (
            <>
              <Icon className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
              Vérification...
            </>
          ) : (
            <>
              <Icon className="fa-solid fa-right-to-bracket" style={{ marginRight: '8px' }} />
              Accéder
            </>
          )}
        </button>

        {/* Footer link back to home */}
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '24px',
            color: 'var(--muted)',
            fontSize: '0.78rem',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted)')}
        >
          <Icon className="fa-solid fa-arrow-left" style={{ fontSize: '0.7rem' }} />
          Retour au site
        </a>
      </form>
    </div>
  );
}
