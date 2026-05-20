export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, hsla(262,88%,64%,0.22), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '12%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, hsla(190,95%,50%,0.16), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 40px', maxWidth: 480, position: 'relative', zIndex: 1, borderRadius: 'var(--radius-lg)' }}>
        <div style={{ fontSize: '5rem', fontWeight: 900, fontFamily: "'Outfit',sans-serif", lineHeight: 1, marginBottom: 8 }} className="gradient-text">
          404
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10 }}>Page introuvable</h1>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.92rem', marginBottom: 28 }}>
          Cette page n&apos;existe pas ou a été déplacée. Retournez à la boutique pour découvrir nos offres.
        </p>
        <a href="/" className="btn btn-primary btn-lg">
          ← Retour à la boutique
        </a>
      </div>
    </div>
  );
}
