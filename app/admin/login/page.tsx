'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogIn } from 'lucide-react';

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
      .then(d => { if (d.authenticated) router.replace('/admin'); })
      .catch(() => setLoginError('Connexion au serveur impossible. Réessayez.'));
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
        setLoginError(totpCode ? (d.error || 'Code de vérification incorrect.') : '');
        return;
      }
      // Cas 429 (trop de tentatives) ou autre : afficher le message réel du serveur
      // pour ne pas masquer un blocage anti-brute-force derrière « Identifiants incorrects ».
      if (r.status === 429) {
        setLoginError(d.error || 'Trop de tentatives. Réessayez dans quelques minutes.');
        return;
      }
      setLoginError(d.error || 'Identifiants incorrects.');
    } catch {
      setLoginError('Connexion au serveur impossible. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="glass-panel admin-login-card">
        <div className="admin-login-icon">SM</div>
        <h1>Administration StreamMalin</h1>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem', marginBottom: 28 }}>
          Zone réservée au personnel autorisé.
        </p>

        <form onSubmit={doLogin} style={{ textAlign: 'left' }}>
          {!needsTotp ? (
            <div className="form-field">
              <label className="form-label" htmlFor="admin-password">Mot de passe</label>
              <input
                id="admin-password"
                type="password"
                maxLength={128}
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
              <label className="form-label" htmlFor="admin-totp">Code de vérification (2FA)</label>
              <input
                id="admin-totp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
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

          {loginError && <div className="error-box" role="alert">{loginError}</div>}

          <button type="submit" className="btn-pay" disabled={loading} style={{ marginTop: 4 }}>
            <LogIn size={17} aria-hidden="true" />{loading ? 'Vérification…' : 'Connexion'}
          </button>
        </form>
        <Link href="/" className="admin-login-return"><ArrowLeft size={15} aria-hidden="true" /> Retour au site</Link>

        <div style={{ marginTop: 20, fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          StreamMalin · Administration
        </div>
      </div>
    </div>
  );
}
