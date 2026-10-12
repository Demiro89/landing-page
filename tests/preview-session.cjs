// Only the disposable UI process loads this session-store double. No application import.
const connection = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.PREVIEW_ISOLATED !== 'true' || connection.hostname !== '127.0.0.1' || !connection.pathname.endsWith('_test')) throw new Error('UI session fixture requires an isolated local environment');
const sessionKey = `admin_session:${'a'.repeat(64)}`;
global.prisma = new Proxy({
  setting: { findUnique: async ({ where }) => where.key === sessionKey ? { key: sessionKey, value: process.env.PREVIEW_ADMIN_EXPIRES } : null },
}, { get(target, key) {
  if (key in target) return target[key];
  throw new Error(`No database operation is allowed in the UI preview (${String(key)})`);
} });
