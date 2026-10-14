type Handler = () => Promise<boolean>;
let handler: Handler | null = null;
let pending: Promise<boolean> | null = null;

export function registerAdminReauthentication(next: Handler) {
  handler = next;
  return () => { if (handler === next) handler = null; };
}

export function requestAdminReauthentication(): Promise<boolean> {
  if (!handler) return Promise.resolve(false);
  if (!pending) pending = handler().finally(() => { pending = null; });
  return pending;
}
