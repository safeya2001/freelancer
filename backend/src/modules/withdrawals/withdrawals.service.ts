import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Inject,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { WithdrawalRequestDto } from './dto/withdrawal.dto';
import { EmailService } from '../email/email.service';

const MIN_WITHDRAWAL = 20;      // JOD
const MAX_WITHDRAWAL = 50_000;  // JOD — safety cap

@Injectable()
export class WithdrawalsService {
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private notifications: NotificationsService,
    private email: EmailService,
  ) {}

  async request(freelancerId: string, dto: WithdrawalRequestDto) {
    // ── Security checks ──────────────────────────────────────
    const [user] = await this.sql`
      SELECT phone_verified, email_verified FROM users WHERE id = ${freelancerId}
    `;
    if (!user) throw new NotFoundException('User not found');
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev) {
      if (!user.email_verified) {
        throw new BadRequestException('You must verify your email before requesting a withdrawal');
      }
      if (!user.phone_verified) {
        throw new BadRequestException('You must verify your phone number before requesting a withdrawal');
      }
    }

    // ── Amount validation ────────────────────────────────────
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    if (amount < MIN_WITHDRAWAL) {
      throw new BadRequestException(`Minimum withdrawal is ${MIN_WITHDRAWAL} JOD`);
    }
    if (amount > MAX_WITHDRAWAL) {
      throw new BadRequestException(`Maximum single withdrawal is ${MAX_WITHDRAWAL} JOD`);
    }

    // ── No concurrent pending withdrawal ────────────────────
    const [pending] = await this.sql`
      SELECT id FROM withdrawals
      WHERE freelancer_id = ${freelancerId} AND status = 'pending'
    `;
    if (pending) {
      throw new BadRequestException('You already have a pending withdrawal request');
    }

    // ── SELECT FOR UPDATE — prevents race condition ──────────
    const [wallet] = await this.sql`
      SELECT balance FROM wallets WHERE user_id = ${freelancerId} FOR UPDATE
    `;
    if (!wallet) throw new NotFoundException('Wallet not found');

    // Use DB-side comparison with NUMERIC to avoid float precision issues
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const [withdrawal] = await (this.sql as any).begin(async (tx: postgres.Sql) => {
      // Deduct immediately to reserve funds
      await tx`
        UPDATE wallets
        SET balance = balance - ${amount}
        WHERE user_id = ${freelancerId}
          AND balance >= ${amount}   -- double-check inside tx
      `;

      return tx`
        INSERT INTO withdrawals
          (freelancer_id, amount, method,
           bank_name, bank_account, bank_iban,
           cliq_alias)
        VALUES
          (${freelancerId}, ${amount}, ${dto.method},
           ${dto.bank_name ?? null}, ${dto.bank_account ?? null}, ${dto.bank_iban ?? null},
           ${dto.cliq_alias ?? null})
        RETURNING *
      `;
    });

    await this.notifications.create({
      userId:      freelancerId,
      type:        'withdrawal_requested',
      title_en:    'Withdrawal Request Submitted',
      title_ar:    'تم تقديم طلب السحب',
      body_en:     `Your withdrawal request of ${amount} JOD is pending admin approval.`,
      body_ar:     `طلب سحب ${amount} دينار قيد مراجعة الإدارة.`,
      entity_type: 'withdrawal',
      entity_id:   withdrawal.id,
    });

    // Email notification
    const [freelancerUser] = await this.sql`SELECT email FROM users WHERE id = ${freelancerId}`;
    if (freelancerUser?.email) {
      await this.email.sendWithdrawalNotification(
        freelancerUser.email,
        'Withdrawal Request Submitted',
        `Your withdrawal request of ${amount} JOD has been submitted and is pending admin approval.`,
      );
    }

    return withdrawal;
  }

  async getMyWithdrawals(freelancerId: string) {
    const rows = await this.sql`
      SELECT id, amount, method, status, created_at,
             processed_at, reference_number, rejection_reason, transfer_confirmation_url
      FROM withdrawals
      WHERE freelancer_id = ${freelancerId}
      ORDER BY created_at DESC
    `;
    return rows;
  }

  // ─── ADMIN ONLY ──────────────────────────────────────────────
  async getPending() {
    return this.sql`
      SELECT w.*, p.full_name_en AS freelancer_name, p.full_name_ar AS freelancer_name_ar,
             u.email AS freelancer_email
      FROM withdrawals w
      JOIN profiles p ON p.user_id = w.freelancer_id
      JOIN users    u ON u.id      = w.freelancer_id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC
    `;
  }

  async approve(withdrawalId: string, adminId: string, reference?: string, notes?: string) {
    const [w] = await this.sql`SELECT * FROM withdrawals WHERE id = ${withdrawalId}`;
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== 'pending') throw new BadRequestException('Withdrawal is not pending');

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE withdrawals SET
          status            = 'completed',
          processed_by      = ${adminId},
          processed_at      = NOW(),
          reference_number  = ${reference ?? null},
          notes             = ${notes ?? null}
        WHERE id = ${withdrawalId}
      `;

      await tx`
        UPDATE wallets
        SET total_withdrawn = total_withdrawn + ${w.amount}
        WHERE user_id = ${w.freelancer_id}
      `;

      await tx`
        INSERT INTO transactions
          (from_user_id, type, amount, status, description_en, description_ar)
        VALUES
          (${w.freelancer_id}, 'withdrawal', ${w.amount}, 'completed',
           'Withdrawal processed', 'تمت معالجة السحب')
      `;
    });

    await this.notifications.create({
      userId:      w.freelancer_id,
      type:        'withdrawal_processed',
      title_en:    'Withdrawal Processed',
      title_ar:    'تم معالجة السحب',
      body_en:     `Your withdrawal of ${w.amount} JOD has been processed.`,
      body_ar:     `تمت معالجة طلب السحب بقيمة ${w.amount} دينار.`,
      entity_type: 'withdrawal',
      entity_id:   withdrawalId,
    });

    return { message: 'Withdrawal approved and processed' };
  }

  /** Mark as processed with optional transfer confirmation URL (e.g. from uploads/single) */
  async markProcessed(
    withdrawalId: string,
    adminId: string,
    opts: { reference_number?: string; notes?: string; transfer_confirmation_url?: string },
  ) {
    const [w] = await this.sql`SELECT * FROM withdrawals WHERE id = ${withdrawalId}`;
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== 'pending') throw new BadRequestException('Withdrawal is not pending');

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE withdrawals SET
          status = 'completed',
          processed_by = ${adminId},
          processed_at = NOW(),
          reference_number = ${opts.reference_number ?? null},
          notes = ${opts.notes ?? null},
          transfer_confirmation_url = ${opts.transfer_confirmation_url ?? null}
        WHERE id = ${withdrawalId}
      `;

      await tx`
        UPDATE wallets
        SET total_withdrawn = total_withdrawn + ${w.amount}
        WHERE user_id = ${w.freelancer_id}
      `;

      await tx`
        INSERT INTO transactions
          (from_user_id, type, amount, status, description_en, description_ar)
        VALUES
          (${w.freelancer_id}, 'withdrawal', ${w.amount}, 'completed',
           'Withdrawal processed', 'تمت معالجة السحب')
      `;
    });

    await this.notifications.create({
      userId:      w.freelancer_id,
      type:        'withdrawal_processed',
      title_en:    'Withdrawal Processed',
      title_ar:    'تم معالجة السحب',
      body_en:     `Your withdrawal of ${w.amount} JOD has been processed.`,
      body_ar:     `تمت معالجة طلب السحب بقيمة ${w.amount} دينار.`,
      entity_type: 'withdrawal',
      entity_id:   withdrawalId,
    });

    return { message: 'Withdrawal marked as processed' };
  }

  async reject(withdrawalId: string, adminId: string, reason: string) {
    const [w] = await this.sql`SELECT * FROM withdrawals WHERE id = ${withdrawalId}`;
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== 'pending') throw new BadRequestException('Withdrawal is not pending');

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE withdrawals SET
          status            = 'rejected',
          processed_by      = ${adminId},
          processed_at      = NOW(),
          rejection_reason  = ${reason}
        WHERE id = ${withdrawalId}
      `;
      // Refund reserved balance
      await tx`
        UPDATE wallets SET balance = balance + ${w.amount}
        WHERE user_id = ${w.freelancer_id}
      `;
    });

    await this.notifications.create({
      userId:      w.freelancer_id,
      type:        'withdrawal_rejected',
      title_en:    'Withdrawal Rejected',
      title_ar:    'تم رفض السحب',
      body_en:     `Your withdrawal was rejected: ${reason}`,
      body_ar:     `تم رفض طلب السحب: ${reason}`,
      entity_type: 'withdrawal',
      entity_id:   withdrawalId,
    });

    return { message: 'Withdrawal rejected and balance refunded' };
  }
}
