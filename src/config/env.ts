import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_API_KEY: process.env.SERVICE_API_KEY || '',

  // Africa's Talking (SMS)
  AT_USERNAME: process.env.AT_USERNAME || 'sandbox',
  AT_API_KEY: process.env.AT_API_KEY || '',
  AT_SENDER_ID: process.env.AT_SENDER_ID || '',

  // SMTP (Email)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // Twilio (WhatsApp)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || '',
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
