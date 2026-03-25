import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Jordanian mobile: 07x → +9627x */
export function normalizeJordanPhone(raw: string): string {
  const digits = raw.replace(/[\s\-().+]/g, '');
  if (digits.startsWith('9627')) return `+${digits}`;
  if (digits.startsWith('07'))   return `+962${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `+962${digits}`;
  return raw; // already formatted or unknown — return as-is
}

/**
 * SMS abstraction layer.
 *
 * Dev  → logs OTP to console; bypass code 123456 also accepted in verifyPhone.
 * Prod → delegates to the configured SMS_PROVIDER (zain | orange | twilio).
 *
 * To add a new provider:
 *   1. Set SMS_PROVIDER=<name> in .env
 *   2. Add a case in `sendViaProdProvider` below
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  readonly isDev: boolean;

  constructor(private config: ConfigService) {
    this.isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
  }

  async send(phone: string, message: string): Promise<void> {
    const normalised = normalizeJordanPhone(phone);

    if (this.isDev) {
      this.logger.log(`[DEV SMS] ▶ To: ${normalised} | ${message}`);
      return;
    }

    await this.sendViaProdProvider(normalised, message);
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    const sender  = this.config.get<string>('SMS_SENDER_ID', 'DopaWork');
    const message = `[${sender}] رمز التحقق الخاص بك: ${otp}. صالح 10 دقائق. / Your OTP: ${otp}. Valid 10 min.`;
    await this.send(phone, message);
  }

  // ─── Provider Router ─────────────────────────────────────────
  private async sendViaProdProvider(phone: string, message: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'console');

    switch (provider) {
      case 'twilio':
        await this.sendTwilio(phone, message);
        break;

      case 'zain':
        await this.sendZain(phone, message);
        break;

      case 'orange':
        await this.sendOrange(phone, message);
        break;

      default:
        // "console" provider or unconfigured — safe fallback
        this.logger.warn(`[SMS] No provider configured. Message not sent to ${phone}.`);
        this.logger.warn(`[SMS] Set SMS_PROVIDER in .env (twilio | zain | orange).`);
    }
  }

  // ─── Twilio ──────────────────────────────────────────────────
  private async sendTwilio(phone: string, message: string): Promise<void> {
    const accountSid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    const authToken  = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    const from       = this.config.getOrThrow<string>('TWILIO_FROM_NUMBER');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('twilio')(accountSid, authToken);
    await client.messages.create({ body: message, from, to: phone });
    this.logger.log(`[SMS/Twilio] Sent to ${phone}`);
  }

  // ─── Zain SMS (Jordan) ───────────────────────────────────────
  private async sendZain(phone: string, message: string): Promise<void> {
    const apiKey  = this.config.getOrThrow<string>('SMS_API_KEY');
    const apiUrl  = this.config.get<string>('SMS_API_URL', 'https://api.zaincash.iq/sms/send');
    const sender  = this.config.get<string>('SMS_SENDER_ID', 'DopaWork');

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to: phone, message, sender }),
    });
    if (!res.ok) {
      const txt = await res.text();
      this.logger.error(`[SMS/Zain] Failed: ${res.status} ${txt}`);
      throw new Error(`Zain SMS error: ${res.status}`);
    }
    this.logger.log(`[SMS/Zain] Sent to ${phone}`);
  }

  // ─── Orange Jordan ───────────────────────────────────────────
  private async sendOrange(phone: string, message: string): Promise<void> {
    const apiKey  = this.config.getOrThrow<string>('SMS_API_KEY');
    const sender  = this.config.get<string>('SMS_SENDER_ID', 'DopaWork');
    const apiUrl  = this.config.get<string>(
      'SMS_API_URL',
      `https://api.orange.jo/smsmessaging/v1/outbound/tel:${sender}/requests`,
    );

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address:              [`tel:${phone}`],
          senderAddress:        `tel:${sender}`,
          outboundSMSTextMessage: { message },
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      this.logger.error(`[SMS/Orange] Failed: ${res.status} ${txt}`);
      throw new Error(`Orange SMS error: ${res.status}`);
    }
    this.logger.log(`[SMS/Orange] Sent to ${phone}`);
  }
}
