import { env } from './env';
import { logger } from './logger';

const required = [
  { key: 'SERVICE_API_KEY', value: env.SERVICE_API_KEY },
  { key: 'AT_USERNAME', value: env.AT_USERNAME },
  { key: 'AT_API_KEY', value: env.AT_API_KEY },
  { key: 'SMTP_HOST', value: env.SMTP_HOST },
  { key: 'SMTP_USER', value: env.SMTP_USER },
  { key: 'SMTP_PASS', value: env.SMTP_PASS },
  { key: 'SMTP_FROM', value: env.SMTP_FROM },
  { key: 'TWILIO_ACCOUNT_SID', value: env.TWILIO_ACCOUNT_SID },
  { key: 'TWILIO_AUTH_TOKEN', value: env.TWILIO_AUTH_TOKEN },
  { key: 'TWILIO_WHATSAPP_NUMBER', value: env.TWILIO_WHATSAPP_NUMBER },
];

export function validateStartupConfig() {
  const missing = required.filter((entry) => !entry.value).map((entry) => entry.key);

  if (missing.length === 0) {
    logger.info({ missing: false }, 'startup config validated');
    return;
  }

  logger.error({ missing }, 'missing required environment variables');

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
