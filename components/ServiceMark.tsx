import './service-mark.css';

export default function ServiceMark({ id, name }: { id: string; name: string }) {
  const brand = ['netflix', 'youtube', 'spotify'].find(value => id === value || id.startsWith(`${value}-`));
  const serviceKey = brand || id.split('-')[0];
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const monogram = serviceKey === 'disney' ? 'D+' : initials;

  return (
    <span className="service-mark" data-service={serviceKey} aria-hidden="true">
      {brand ? <span className="service-mark-glyph" /> : <span className="service-mark-text">{monogram}</span>}
    </span>
  );
}
