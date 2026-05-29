'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccesPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/acces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (d.success) {
        router.replace('/');
        router.refresh();
        return;
      }
      setError(d.error || 'Code incorrect.');
    } catch {
      setError('Une erreur est survenue. Réessayez.');
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
          Site en <span className="gradient-text">accès restreint</span>
        </h2>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem', marginBottom: 28 }}>
          Le site est temporairement réservé. Saisissez le code d&apos;accès pour continuer.
        </p>

        <form onSubmit={submit} style={{ textAlign: 'left' }}>
          <div className="form-field">
            <label className="form-label">Code d&apos;accès</label>
            <input
              type="password"
              placeholder="••••••••"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="dash-input"
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="btn-pay" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
