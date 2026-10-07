const { spawn } = require('node:child_process');
const path = require('node:path');

// No real credential, database or payment can be reached from this UI preview.
const env = { ...process.env,
  SITE_ACCESS_CODE: '', ADMIN_SECRET_TOKEN: 'audit-local-admin-secret-not-for-production',
  CLIENT_SESSION_SECRET: 'ui-preview-client-secret-not-for-production',
  ENCRYPTION_KEY: 'ui-preview-encryption-key-not-for-production',
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:5432/streammalin_ui_test',
  DIRECT_URL: 'postgresql://fixture:fixture@127.0.0.1:5432/streammalin_ui_test',
  STRIPE_SECRET_KEY: 'sk_test_mock', STRIPE_WEBHOOK_SECRET: '', RESEND_API_KEY: '',
  TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', CRON_SECRET: '',
  COMMERCE_ENABLED: 'false', REMEDIATION_SCHEMA_ENABLED: 'false', DELIVERY_WORKER_ENABLED: 'false',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3101', NEXT_TELEMETRY_DISABLED: '1',
};
const next = spawn(process.execPath, [require.resolve('next/dist/bin/next'), process.env.PREVIEW_PRODUCTION === 'true' ? 'start' : 'dev', '--port', '3100'], { env, stdio: 'inherit', windowsHide: true });
const fixture = spawn(process.execPath, [path.join(__dirname, 'ui-preview.cjs')], { env, stdio: 'inherit', windowsHide: true });
function stop() { next.kill(); fixture.kill(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
next.on('exit', () => fixture.kill()); fixture.on('exit', () => next.kill());
