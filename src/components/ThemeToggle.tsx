'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('sm-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('sm-theme', next); } catch { /* ignore */ }
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) return <div style={{ width: '32px', height: '32px' }} />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label={isDark ? 'Mode clair' : 'Mode sombre'}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: 'transparent',
        border: '1px solid var(--border2)',
        color: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--border)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
      }}
    >
      <i className={isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} />
    </button>
  );
}
