import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseNumber(process.env.PORT, 3000),
  SERVICE_API_KEY: process.env.SERVICE_API_KEY || '',
  DIAGNOSTICS_ENABLED: (process.env.DIAGNOSTICS_ENABLED || '').toLowerCase() === 'true',
  CORS_ORIGINS: corsOrigins,
  RATE_LIMIT_WINDOW_MS: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  RATE_LIMIT_MAX: parseNumber(process.env.RATE_LIMIT_MAX, 100),
  NOTIFICATION_STORE_PATH: process.env.NOTIFICATION_STORE_PATH || 'data/notifications.log',
  PROVIDER_TIMEOUT_MS: parseNumber(process.env.PROVIDER_TIMEOUT_MS, 20_000),

  // Africa's Talking (SMS)
  AT_USERNAME: process.env.AT_USERNAME || 'sandbox',
  AT_API_KEY: process.env.AT_API_KEY || '',
  AT_SENDER_ID: process.env.AT_SENDER_ID || '',

  // SMTP (Email)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseNumber(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // Twilio (WhatsApp)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || '',
};

export const providerConfig = {
  hasSmsProvider: Boolean(env.AT_USERNAME && env.AT_API_KEY),
  hasEmailProvider: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM),
  hasWhatsappProvider: Boolean(
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER
  ),
  hasAnyProvider:
    Boolean(env.AT_USERNAME && env.AT_API_KEY) ||
    Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM) ||
    Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER),
};

/**
 * Throws a clear, channel-specific error instead of letting an SDK fail
 * deep in a stack trace when credentials haven't been configured yet.
 */
export function assertConfigured(channel: string, values: Record<string, string>): void {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `[${channel}] Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Check your .env file against .env.example.`
    );
  }
}
