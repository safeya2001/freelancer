import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;

  private readonly isDev: boolean;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.fromAddress = this.config.get<string>('SMTP_FROM', 'noreply@freelance.jo');
    this.isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';

    const isPlaceholder = (v?: string) => !v || v === 'placeholder' || v.includes('placeholder');
    const hasRealSmtp = !!(host && user && pass && !isPlaceholder(host) && !isPlaceholder(user) && !isPlaceholder(pass));

    if (hasRealSmtp) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: false,
        auth: { user, pass },
      });
      this.logger.log('Email transporter configured');
    } else {
      this.logger.warn('SMTP credentials not set or placeholder — emails will be logged to console only');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject} | (no SMTP configured)`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3002');
    const link = `${frontendUrl}/auth/verify-email?token=${token}`;

    if (this.isDev || !this.transporter) {
      this.logger.log(`[DEBUG] Verification Email Link: ${link}`);
    }

    if (!this.transporter) return;

    await this.send(
      email,
      'Verify your email address',
      `<h2>Verify your email</h2>
       <p>Click the link below to verify your email address. This link expires in 24 hours.</p>
       <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Verify Email</a>
       <p>Or copy: ${link}</p>`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/auth/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your password',
      `<h2>Password Reset</h2>
       <p>You requested a password reset. Click the link below (expires in 2 hours):</p>
       <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset Password</a>
       <p>If you did not request this, ignore this email.</p>`,
    );
  }

  async sendOrderNotification(
    email: string,
    subject: string,
    message: string,
    orderId: string,
  ): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/orders/${orderId}`;
    await this.send(
      email,
      subject,
      `<h2>${subject}</h2>
       <p>${message}</p>
       <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">View Order</a>`,
    );
  }

  async sendWithdrawalNotification(
    email: string,
    subject: string,
    message: string,
  ): Promise<void> {
    await this.send(
      email,
      subject,
      `<h2>${subject}</h2><p>${message}</p>`,
    );
  }

  async sendAnnouncement(email: string, subject: string, bodyHtml: string): Promise<void> {
    await this.send(
      email,
      subject,
      `<h2>${subject}</h2><div>${bodyHtml}</div><p style="color:#666;font-size:12px;">— Freelance.JO Platform</p>`,
    );
  }

  async sendDisputeNotification(
    email: string,
    subject: string,
    message: string,
    disputeId: string,
  ): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const link = `${frontendUrl}/disputes/${disputeId}`;
    await this.send(
      email,
      subject,
      `<h2>${subject}</h2>
       <p>${message}</p>
       <a href="${link}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">View Dispute</a>`,
    );
  }
}
