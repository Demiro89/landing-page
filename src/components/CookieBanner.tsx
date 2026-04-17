// 📄 FILE: src/components/CookieBanner.tsx
'use client';

import { useEffect, useState } from 'react';

const GA_ID = 'G-S29G36JGQJ';

type Consent = 'accepted' | 'rejected';

interface GtagWindow extends Window {
  dataLayer: unknown[];
  gtag: (...args: unknown[]) => void;
}

function injectGA(): void {
  if (typeof window === 'undefined' || document.getElementById('ga-script')) return;
  const w = window as unknown as GtagWindow;
  const el = document.createElement('script');
  el.id = 'ga-script';
  el.async = true;
  el.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(el);
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function (...args: unknown[]) { w.dataLayer.push(args); };
  w.gtag('js', new Date());
  w.gtag('config', GA_ID);
}

export default function CookieBanner() {
  const [consent, setConsent] = useState<Consent | null | 'unset'>('unset');
  const [showModal, setShowModal] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('cookie_consent') as Consent | null;
    setConsent(stored);
    if (stored === 'accepted') injectGA();
  }, []);

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted');
    setConsent('accepted');
    injectGA();
  }

  function reject() {
    localStorage.setItem('cookie_consent', 'rejected');
    setConsent('rejected');
  }

  function saveCustom() {
    const value: Consent = analyticsChecked ? 'accepted' : 'rejected';
    localStorage.setItem('cookie_consent', value);
    setConsent(value);
    if (analyticsChecked) injectGA();
    setShowModal(false);
  }

  // Hidden until localStorage is read (avoids SSR flash)
  if (consent !== null) return null;

  return (
    <>
      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#0e0e1a]/95 p-5 shadow-2xl backdrop-blur-md">
          <p className="mb-4 text-sm leading-relaxed text-gray-300">
            🍪 StreamMalin utilise des cookies analytiques pour améliorer votre expérience.
            Les cookies strictement nécessaires sont toujours actifs.{' '}
            <button
              onClick={() => setShowModal(true)}
              className="underline underline-offset-2 hover:text-white"
            >
              En savoir plus
            </button>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={accept}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
            >
              Accepter
            </button>
            <button
              onClick={reject}
              className="rounded-lg border border-white/20 px-5 py-2 text-sm font-semibold text-gray-300 transition hover:border-white/40 hover:text-white"
            >
              Refuser
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg border border-white/10 px-5 py-2 text-sm text-gray-400 transition hover:text-white"
            >
              Personnaliser
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e1a] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-bold text-white">Paramètres des cookies</h2>
            <p className="mb-5 text-xs text-gray-400">
              Choisissez les catégories de cookies que vous autorisez.
            </p>

            {/* Essential — always on */}
            <div className="mb-3 flex items-start gap-3 rounded-xl border border-white/8 bg-white/5 p-4">
              <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded bg-violet-600" />
              <div>
                <p className="text-sm font-semibold text-white">Strictement nécessaires</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Authentification, panier, sécurité. Toujours actifs.
                </p>
              </div>
            </div>

            {/* Analytics — optional */}
            <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/5 p-4">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-violet-600"
              />
              <div>
                <p className="text-sm font-semibold text-white">Analytiques</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Mesure d'audience anonyme (Google Analytics). Nous aide à améliorer le site.
                </p>
              </div>
            </label>

            <div className="flex gap-2">
              <button
                onClick={saveCustom}
                className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
              >
                Enregistrer
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm text-gray-400 transition hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
