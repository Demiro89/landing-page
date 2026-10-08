const euroFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatEuro(amount: number): string {
  return euroFormatter.format(amount);
}

export function matchesServiceFilter(id: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => id === prefix || id.startsWith(`${prefix}-`));
}

export type StreamingCategory = 'video' | 'music' | 'other';

const videoServices = ['netflix', 'youtube', 'disney', 'prime', 'amazon-prime', 'apple-tv', 'max', 'hbo', 'paramount', 'crunchyroll', 'adn', 'dazn', 'canal', 'bein', 'rmc'];
const musicServices = ['spotify', 'deezer', 'tidal', 'apple-music', 'amazon-music', 'qobuz'];

export function streamingCategory(id: string): StreamingCategory {
  if (matchesServiceFilter(id, videoServices)) return 'video';
  if (matchesServiceFilter(id, musicServices)) return 'music';
  return 'other';
}

export function canCompareOffer(offer: { referenceVerified?: boolean; original: number; price: number; availableSlots: number; availableStockId: string | null }): boolean {
  return hasAvailableOffer(offer) && offer.referenceVerified === true && Number.isFinite(offer.price)
    && offer.price > 0 && Number.isFinite(offer.original) && offer.original >= offer.price;
}

export function hasAvailableOffer(offer: { availableSlots: number; availableStockId: string | null }): boolean {
  return Number.isInteger(offer.availableSlots) && offer.availableSlots > 0 && Boolean(offer.availableStockId);
}

const prudentReplacements: Array<[RegExp, string]> = [
  [/conformit[eé] l[eé]gale garantie(?: [aà])? ?100\s*%/gi, 'Service encadré par des CGV et un support client dédié'],
  [/garanti(?:e)? sans coupure|sans aucune coupure/gi, 'Suivi des accès et assistance en cas de dysfonctionnement'],
  [/(?:livraison instantan[eé]e|acc[eè]s imm[eé]diat(?:s)? apr[eè]s achat|acc[eè]s envoy[eé]s imm[eé]diatement)/gi, 'Accès transmis après validation du paiement et selon disponibilité'],
  [/support(?: client)? 24\s*\/\s*7/gi, 'Support client en français'],
  [/z[eé]ro risque|garantie totale|100\s*% s[eé]curis[eé](?:e)?/gi, 'Service encadré par des CGV'],
  [/ultra-s[eé]curis[eé](?:e)?/gi, 'protégée selon les fonctionnalités de l’offre'],
  [/politique stricte no-logs|no-logs/gi, 'Politique de confidentialité du fournisseur applicable'],
  [/illimit[eé](?:es|e|s)?/gi, 'selon offre'],
];

// Persisted catalogue descriptions also pass through this projection; no records are rewritten.
export function prudentCommercialCopy(value: string): string {
  return prudentReplacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}
