'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { SiteWordmark } from '@/components/SiteHeader';

export default function AccesPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
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
    <main className="site-theme site-gate">
      <div className="site-gate-content">
        <div className="site-wordmark"><SiteWordmark /></div>
        <h1>Accès privé</h1>
        <form onSubmit={submit}>
          <div className="form-field">
            <label className="form-label" htmlFor="site-access-code">Code d&apos;accès</label>
            <div style={{ position: 'relative' }}>
              <input
                id="site-access-code"
                type={showCode ? 'text' : 'password'}
                maxLength={128}
                placeholder="Votre code"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="dash-input"
                style={{ paddingRight: 44 }}
                required
                autoFocus
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--site-muted)' }}
                aria-label={showCode ? 'Masquer le code d’accès' : 'Afficher le code d’accès'}
                aria-pressed={showCode}
              >
                {showCode ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && <div className="error-box" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
      </div>
    </main>
  );
}
