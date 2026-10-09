export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && !/[\u0000-\u001f\u007f]/.test(email) && /^[^\s<>"'@]+@[^\s<>"'@]+\.[^\s<>"'@]+$/.test(email) ? email : null;
}

export function validateCheckout(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Paramètres invalides' } as const;
  const input = body as Record<string, unknown>;
  const validId = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
  if (!validId(input.serviceId) || !validId(input.stockAccountId)) return { error: 'Identifiant invalide' } as const;
  const email = normalizeEmail(input.email);
  const youtubeEmail = input.youtubeEmail === undefined || input.youtubeEmail === '' ? null : normalizeEmail(input.youtubeEmail);
  if (!email) return { error: 'Adresse email invalide' } as const;
  if ((input.youtubeEmail && !youtubeEmail) || ((input.serviceId === 'youtube' || input.serviceId.startsWith('youtube-')) && !youtubeEmail)) {
    return { error: 'Adresse e-mail YouTube valide requise' } as const;
  }
  if (input.acceptedCgv !== true || input.acceptedImmediateExecution !== true || input.acceptedEligibility !== true) {
    return { error: "Vous devez accepter les CGV, la demande d'exécution immédiate et confirmer votre éligibilité." } as const;
  }
  return { serviceId: input.serviceId, stockAccountId: input.stockAccountId, email, youtubeEmail } as const;
}
