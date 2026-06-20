export type Channel = 'sms' | 'email' | 'whatsapp';

export interface NotificationPayload {
  to: string;
  message: string;
  /** Email only — ignored by other channels. */
  subject?: string;
  /** Free-form extra data, passed through and echoed back for traceability. */
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channel: Channel;
  provider: string;
  /** Provider-assigned id (Africa's Talking messageId, Twilio SID, SMTP messageId...) */
  externalId?: string;
  status: string;
  /** Raw provider response, useful for debugging during a demo. */
  raw?: unknown;
}

/**
 * Every channel adapter implements this. The NotificationService doesn't know
 * or care how a given channel actually sends the message — that's the point.
 */
export interface NotificationProvider {
  readonly channel: Channel;
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
