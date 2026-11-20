import 'server-only';

export function logServerFailure(operation: string, error: unknown) {
  // Provider and database errors can include request data and credentials.
  const code = error && typeof error === 'object' && 'code' in error &&
    typeof error.code === 'string' && /^P\d{4}$/.test(error.code) ? error.code : undefined;
  console.error(`[${operation}] Failed`, ...(code ? [code] : []));
}
