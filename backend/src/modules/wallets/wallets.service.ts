import {
  Injectable, Inject, NotFoundException, BadRequestException,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class WalletsService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  // ─── GET MY WALLET ───────────────────────────────────────────
  async getMyWallet(userId: string) {
    const [wallet] = await this.sql`
      SELECT
        w.balance,
        w.pending_balance,
        w.total_earned,
        w.total_withdrawn,
        -- Available = balance minus any pending withdrawal requests
        w.balance - COALESCE(
          (SELECT SUM(amount) FROM withdrawals
           WHERE freelancer_id = ${userId} AND status = 'pending'), 0
        ) AS available_balance
      FROM wallets w
      WHERE w.user_id = ${userId}
    `;
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  // ─── TRANSACTION HISTORY ─────────────────────────────────────
  async getMyTransactions(userId: string, limit = 50, offset = 0) {
    return this.sql`
      SELECT
        t.id, t.type, t.amount, t.status,
        t.description_en, t.description_ar,
        t.created_at,
        CASE WHEN t.to_user_id = ${userId} THEN 'credit' ELSE 'debit' END AS direction,
        fu.email  AS from_email,
        tu.email  AS to_email,
        t.order_id, t.milestone_id
      FROM transactions t
      LEFT JOIN users fu ON fu.id = t.from_user_id
      LEFT JOIN users tu ON tu.id = t.to_user_id
      WHERE (t.from_user_id = ${userId} OR t.to_user_id = ${userId})
        AND t.status = 'completed'
      ORDER BY t.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // ─── ESCROW LEDGER ───────────────────────────────────────────
  async getMyEscrows(userId: string) {
    return this.sql`
      SELECT
        ea.id, ea.amount, ea.net_amount, ea.commission,
        ea.status, ea.created_at, ea.released_at,
        COALESCE(g.title_en, proj.title_en)   AS ref_title_en,
        COALESCE(g.title_ar, proj.title_ar)   AS ref_title_ar,
        ea.order_id, ea.milestone_id
      FROM escrow_accounts ea
      LEFT JOIN orders      o    ON o.id    = ea.order_id
      LEFT JOIN gigs        g    ON g.id    = o.gig_id
      LEFT JOIN milestones  ms   ON ms.id   = ea.milestone_id
      LEFT JOIN contracts   c    ON c.id    = ms.contract_id
      LEFT JOIN projects    proj ON proj.id = c.project_id
      WHERE ea.freelancer_id = ${userId} OR ea.client_id = ${userId}
      ORDER BY ea.created_at DESC
    `;
  }

  // ─── ADMIN: ALL WALLETS ──────────────────────────────────────
  async getAllWallets() {
    return this.sql`
      SELECT
        w.*,
        u.email,
        u.role,
        p.full_name_en
      FROM wallets w
      JOIN users u    ON u.id = w.user_id
      JOIN profiles p ON p.user_id = w.user_id
      ORDER BY w.balance DESC
      LIMIT 200
    `;
  }

  // ─── ADMIN: PLATFORM REVENUE SUMMARY ────────────────────────
  async getPlatformRevenue() {
    const [summary] = await this.sql`
      SELECT
        SUM(CASE WHEN type = 'commission' THEN amount ELSE 0 END) AS total_commission,
        SUM(CASE WHEN type = 'deposit'    THEN amount ELSE 0 END) AS total_deposited,
        SUM(CASE WHEN type = 'release'    THEN amount ELSE 0 END) AS total_released,
        SUM(CASE WHEN type = 'refund'     THEN amount ELSE 0 END) AS total_refunded,
        COUNT(CASE WHEN type = 'deposit'  THEN 1      END)        AS total_transactions
      FROM transactions
      WHERE status = 'completed'
    `;

    const monthly = await this.sql`
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        SUM(CASE WHEN type = 'commission' THEN amount ELSE 0 END) AS commission,
        SUM(CASE WHEN type = 'deposit'    THEN amount ELSE 0 END) AS deposited
      FROM transactions
      WHERE status = 'completed'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month
    `;

    return { summary, monthly };
  }

  // ─── INTERNAL: ENSURE WALLET EXISTS ─────────────────────────
  // Called after user creation if trigger did not run
  async ensureWalletExists(userId: string) {
    await this.sql`
      INSERT INTO wallets (user_id) VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
}
