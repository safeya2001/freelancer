import {
  Injectable, ConflictException, UnauthorizedException,
  BadRequestException, Inject, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import {
  RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto,
} from './dto/register.dto';
import { EmailService } from '../email/email.service';
import { SmsService, normalizeJordanPhone } from '../sms/sms.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  // ─── REGISTER ────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const [existing] = await this.sql`SELECT id FROM users WHERE email = ${dto.email}`;
    if (existing) throw new ConflictException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const email_verify_token = uuidv4();
    const email_verify_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const normalizedPhone = dto.phone ? normalizeJordanPhone(dto.phone) : null;

    const isDev = process.env.NODE_ENV !== 'production';
    // In dev: register as active + pre-verified so login works immediately
    const initialStatus = isDev ? 'active' : 'pending';

    const [user] = await this.sql`
      INSERT INTO users (email, phone, password_hash, role, status, preferred_language,
                         email_verified, phone_verified,
                         email_verify_token, email_verify_expires)
      VALUES (${dto.email}, ${normalizedPhone}, ${password_hash}, ${dto.role},
              ${initialStatus}, ${dto.preferred_language ?? 'ar'},
              ${isDev}, ${isDev},
              ${isDev ? null : email_verify_token},
              ${isDev ? null : email_verify_expires})
      RETURNING id, email, role
    `;

    await this.sql`
      INSERT INTO profiles (user_id, full_name_en, full_name_ar)
      VALUES (${user.id}, ${dto.full_name_en}, ${dto.full_name_ar ?? null})
    `;

    // Send verification email
    await this.emailService.sendVerificationEmail(dto.email, email_verify_token);
    this.logger.log(`Verification email queued for user ${user.id}`);

    return {
      message: isDev
        ? 'Registration successful. Account is pre-verified for development — you can log in immediately.'
        : 'Registration successful. Please check your email to verify your account.',
      user_id: user.id,
    };
  }

  // ─── LOGIN ───────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const [user] = await this.sql`
      SELECT id, email, password_hash, role, status, email_verified
      FROM users WHERE email = ${dto.email}
    `;

    // Generic message — never reveal whether email exists
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'banned')    throw new UnauthorizedException('Account has been banned');
    if (user.status === 'suspended') throw new UnauthorizedException('Account is suspended');
    // In dev: skip email verification gate so any registered account can log in
    if (process.env.NODE_ENV === 'production' && user.status === 'pending') {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    await this.sql`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { ...tokens, role: user.role, email_verified: user.email_verified };
  }

  // ─── GOOGLE OAUTH ────────────────────────────────────────────
  async googleLogin(googleUser: { google_id: string; email: string; full_name_en: string }) {
    let [user] = await this.sql`
      SELECT id, email, role, status FROM users WHERE google_id = ${googleUser.google_id}
    `;

    if (!user) {
      [user] = await this.sql`
        SELECT id, email, role, status FROM users WHERE email = ${googleUser.email}
      `;
      if (user) {
        await this.sql`UPDATE users SET google_id = ${googleUser.google_id} WHERE id = ${user.id}`;
      } else {
        [user] = await this.sql`
          INSERT INTO users (email, google_id, role, status, email_verified, preferred_language)
          VALUES (${googleUser.email}, ${googleUser.google_id}, 'client', 'active', true, 'ar')
          RETURNING id, email, role, status
        `;
        await this.sql`
          INSERT INTO profiles (user_id, full_name_en)
          VALUES (${user.id}, ${googleUser.full_name_en})
        `;
      }
    }

    if (user.status === 'banned')    throw new UnauthorizedException('Account has been banned');
    if (user.status === 'suspended') throw new UnauthorizedException('Account is suspended');

    return this.generateTokens(user.id, user.email, user.role);
  }

  // ─── VERIFY EMAIL ────────────────────────────────────────────
  async verifyEmail(token: string) {
    const [user] = await this.sql`
      SELECT id FROM users
      WHERE email_verify_token = ${token}
        AND email_verify_expires > NOW()
    `;
    if (!user) throw new BadRequestException('Invalid or expired verification link');

    await this.sql`
      UPDATE users SET
        email_verified       = true,
        email_verify_token   = null,
        email_verify_expires = null,
        status               = 'active'
      WHERE id = ${user.id}
    `;
    return { message: 'Email verified successfully. You can now log in.' };
  }

  // ─── SEND PHONE OTP ──────────────────────────────────────────
  async sendPhoneOtp(userId: string) {
    const [user] = await this.sql`SELECT phone FROM users WHERE id = ${userId}`;
    if (!user?.phone) throw new BadRequestException('No phone number on this account. Please update your profile first.');

    const normalised = normalizeJordanPhone(user.phone);
    const otp     = randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await this.sql`
      UPDATE users SET phone_otp = ${otp}, phone_otp_expires = ${expires}
      WHERE id = ${userId}
    `;

    await this.smsService.sendOtp(normalised, otp);

    if (this.smsService.isDev) {
      this.logger.log(`[DEBUG] Phone OTP for user ${userId} (${normalised}): ${otp}  ← also try bypass 123456`);
    } else {
      this.logger.log(`OTP sent to user ${userId}`);
    }
    return { message: 'OTP sent to your registered phone number' };
  }

  // ─── VERIFY PHONE OTP ────────────────────────────────────────
  async verifyPhone(userId: string, otp: string) {
    // Dev bypass: accept 123456 without checking DB
    if (this.smsService.isDev && otp === '123456') {
      await this.sql`
        UPDATE users
        SET phone_verified = true, phone_otp = null, phone_otp_expires = null
        WHERE id = ${userId}
      `;
      this.logger.log(`[DEBUG] Phone verified via bypass code for user ${userId}`);
      return { message: 'Phone verified successfully (dev bypass)' };
    }

    const [user] = await this.sql`
      SELECT id FROM users
      WHERE id = ${userId}
        AND phone_otp = ${otp}
        AND phone_otp_expires > NOW()
    `;
    if (!user) throw new BadRequestException('Invalid or expired OTP');

    await this.sql`
      UPDATE users
      SET phone_verified = true, phone_otp = null, phone_otp_expires = null
      WHERE id = ${userId}
    `;
    return { message: 'Phone verified successfully' };
  }

  // ─── FORGOT PASSWORD ─────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const [user] = await this.sql`SELECT id FROM users WHERE email = ${dto.email}`;

    // Always return the same response — prevents account enumeration via timing
    const GENERIC = { message: 'If that email exists, a reset link has been sent.' };

    if (!user) return GENERIC;

    const token = uuidv4();
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await this.sql`
      UPDATE users SET reset_password_token = ${token}, reset_password_expires = ${expires}
      WHERE id = ${user.id}
    `;

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(dto.email, token);
    // IMPORTANT: never log the token — it is a credential
    this.logger.log(`Password reset requested for user ${user.id}`);

    return GENERIC;
  }

  // ─── RESET PASSWORD ──────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const [user] = await this.sql`
      SELECT id FROM users
      WHERE reset_password_token = ${dto.token}
        AND reset_password_expires > NOW()
    `;
    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const password_hash = await bcrypt.hash(dto.new_password, 12);

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE users SET
          password_hash          = ${password_hash},
          reset_password_token   = null,
          reset_password_expires = null
        WHERE id = ${user.id}
      `;
      // Revoke all refresh tokens — force re-login everywhere
      await tx`
        UPDATE refresh_tokens SET is_revoked = true WHERE user_id = ${user.id}
      `;
    });

    return { message: 'Password reset successfully. Please log in again.' };
  }

  // ─── REFRESH TOKEN ───────────────────────────────────────────
  // SHA-256 hash of the UUID token — bcrypt is for passwords, not high-entropy tokens
  async refreshToken(rawToken: string) {
    if (!rawToken) throw new UnauthorizedException('Refresh token required');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const [record] = await this.sql`
      SELECT rt.user_id, rt.id AS token_id, u.email, u.role, u.status
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ${tokenHash}
        AND rt.expires_at > NOW()
        AND rt.is_revoked = false
    `;

    if (!record) throw new UnauthorizedException('Invalid or expired refresh token');
    if (record.status === 'banned' || record.status === 'suspended') {
      throw new UnauthorizedException('Account is not active');
    }

    // Rotate — revoke old, issue new pair
    await this.sql`UPDATE refresh_tokens SET is_revoked = true WHERE id = ${record.token_id}`;

    return this.generateTokens(record.user_id, record.email, record.role);
  }

  // ─── REVOKE ALL REFRESH TOKENS ───────────────────────────────
  async revokeAllRefreshTokens(userId: string) {
    await this.sql`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = ${userId}`;
  }

  // ─── TOKEN GENERATION ────────────────────────────────────────
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const access_token = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refresh_token = uuidv4();
    const refresh_hash = createHash('sha256').update(refresh_token).digest('hex');
    const refresh_expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${userId}, ${refresh_hash}, ${refresh_expires})
    `;

    return { access_token, refresh_token };
  }
}
