import Image from 'next/image';
import './service-mark.css';

export default function ServiceMark({ id, name }: { id: string; name: string }) {
  const brand = ['netflix', 'youtube', 'spotify'].find(value => id === value || id.startsWith(`${value}-`));
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

  return (
    <span className="service-mark" aria-hidden="true">
      {brand ? <Image src={`/brands/${brand}.svg`} alt="" width={28} height={28} /> : initials}
    </span>
  );
}
