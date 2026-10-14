import { History } from 'lucide-react';
import { formatEuro } from '@/lib/offerPresentation';

export default function AdminActivityChart({ days }: { days: { label: string; profit: number }[] }) {
  const maximum = Math.max(1, ...days.map(day => Math.abs(day.profit)));
  return (
    <section className="admin-card admin-activity">
      <h2 className="admin-card-head"><History size={18} aria-hidden="true" /> Estimation par commandes · 7 jours</h2>
      <p className="admin-card-sub">Hors renouvellements, frais, taxes et remboursements.</p>
      <div className="admin-activity-bars">
        {days.map(day => (
          <div key={day.label} className="admin-activity-day">
            <span>{day.profit === 0 ? '—' : formatEuro(day.profit)}</span>
            <div className="admin-activity-bar" style={{ height: Math.max(Math.abs(day.profit) / maximum * 100, 3), background: day.profit < 0 ? 'var(--accent-red)' : 'var(--primary)' }} />
            <span>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
