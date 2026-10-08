import { normalizeEmail } from './checkoutValidation';

export const CONTACT_TOPICS = {
  availability: 'Disponibilité d’une offre',
  eligibility: 'Éligibilité de mon compte',
  order: 'Commande ou accès existant',
  other: 'Autre question',
} as const;

export interface ContactMessage {
  email: string;
  topic: keyof typeof CONTACT_TOPICS;
  message: string;
  attemptId: string;
}

export function validateContact(body: unknown): ContactMessage | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const values = body as Record<string, unknown>;
  const email = normalizeEmail(values.email);
  if (!email || (values.website !== undefined && values.website !== '')) return null;
  if (typeof values.topic !== 'string' || !Object.hasOwn(CONTACT_TOPICS, values.topic)) return null;
  if (typeof values.message !== 'string' || typeof values.attemptId !== 'string') return null;
  const message = values.message.trim();
  if (message.length < 10 || message.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) return null;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(values.attemptId)) return null;
  return { email, topic: values.topic as ContactMessage['topic'], message, attemptId: values.attemptId.toLowerCase() };
}
