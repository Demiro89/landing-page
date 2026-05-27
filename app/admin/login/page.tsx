'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth')
      .then(r => r.json())
      .then(d => { if (d.authenticated) router.replace('/admin'); });
  }, [router]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const r = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, totp: totpCode || undefined }),
      });
      const d = await r.json();
      if (d.success) { router.replace('/admin'); return; }
      if (d.needsTotp) {
        setNeedsTotp(true);
        setLoginError(totpCode ? 'Code de vérification incorrect.' : '');
        return;
      }
      setLoginError('Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, hsla(258,90%,66%,0.2), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '12%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, hsla(239,84%,67%,0.14), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div className="glass-panel admin-login-card">
        <div className="admin-login-icon">SM</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>
          Accès <span className="gradient-text">restreint</span>
        </h2>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem', marginBottom: 28 }}>
          Zone réservée au personnel autorisé.
        </p>

        <form onSubmit={doLogin} style={{ textAlign: 'left' }}>
          {!needsTotp ? (
            <div className="form-field">
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="dash-input"
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>
          ) : (
            <div className="form-field">
              <label className="form-label">Code de vérification (2FA)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="dash-input"
                required
                autoFocus
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Code à 6 chiffres de votre application d&apos;authentification.
              </div>
            </div>
          )}

          {loginError && <div className="error-box">{loginError}</div>}

          <button type="submit" className="btn-pay" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Vérification…' : 'Connexion'}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Accès sécurisé · Toutes les tentatives sont enregistrées
        </div>
      </div>
    </div>
  );
}
