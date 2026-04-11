'use client';

import { useState, useRef } from 'react';

export default function AdminLoginPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = inputRef.current?.value ?? '';
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const res  = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Erreur');

      // ── Diagnostic cookie (console navigateur) ──────────────────────────
      console.log('[login] ✅ Réponse serveur ok:', data);
      console.log('[login] Cookies après login :', document.cookie);
      console.log('[login] sm_admin_auth présent :', document.cookie.includes('sm_admin_auth'));
      // ────────────────────────────────────────────────────────────────────

      // Redirection forcée (recharge complète, lit le cookie immédiatement)
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
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background:   'var(--card)',
          border:       '1px solid var(--border)',
          borderRadius: '20px',
          padding:      '40px 36px',
          width:        '100%',
          maxWidth:     '380px',
          textAlign:    'center',
        }}
      >
        {/* Icône */}
        <div
          style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'rgba(124,58,237,0.15)', color: '#a78bfa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', margin: '0 auto 22px',
          }}
        >
          <i className="fa-solid fa-shield-halved" />
        </div>

        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize:   '1.35rem',
            fontWeight: 800,
            marginBottom: '6px',
          }}
        >
          Admin StreamMalin
        </h1>
        <p style={{ fontSize: '0.84rem', color: 'var(--muted)', marginBottom: '28px' }}>
          Entrez votre mot de passe pour accéder au panneau d'administration.
        </p>

        <input
          ref={inputRef}
          type="password"
          placeholder="Mot de passe..."
          required
          autoFocus
          style={{
            width:        '100%',
            background:   'rgba(255,255,255,0.04)',
            border:       '1px solid var(--border2)',
            borderRadius: '9px',
            padding:      '12px 14px',
            fontSize:     '0.9rem',
            color:        'var(--text)',
            outline:      'none',
            fontFamily:   'monospace',
            marginBottom: '14px',
            boxSizing:    'border-box',
          }}
        />

        {error && (
          <div
            style={{
              background:   'rgba(255,59,59,0.08)',
              border:       '1px solid rgba(255,59,59,0.3)',
              borderRadius: '8px',
              padding:      '10px 14px',
              fontSize:     '0.82rem',
              color:        '#ff6b6b',
              marginBottom: '14px',
              textAlign:    'left',
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '7px' }} />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width:      '100%',
            background: loading
              ? 'rgba(124,58,237,0.4)'
              : 'linear-gradient(135deg,#2563eb,#7c3aed)',
            color:        '#fff',
            fontFamily:   'Syne, sans-serif',
            fontWeight:   700,
            fontSize:     '0.92rem',
            padding:      '13px',
            borderRadius: '10px',
            border:       'none',
            cursor:       loading ? 'not-allowed' : 'pointer',
            transition:   'opacity 0.2s',
          }}
        >
          {loading ? (
            <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />Vérification...</>
          ) : (
            <><i className="fa-solid fa-right-to-bracket" style={{ marginRight: '8px' }} />Accéder</>
          )}
        </button>
      </form>
    </div>
  );
}
