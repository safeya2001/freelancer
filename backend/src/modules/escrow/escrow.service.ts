import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(@Inject(DB) private sql: postgres.Sql) {}

  /** Read commission rate from platform_settings; fallback to 10% if missing. */
  private async getCommissionRate(): Promise<number> {
    const [setting] = await this.sql`
      SELECT value FROM platform_settings WHERE key = 'commission_rate'
    `;
    const rate = setting ? parseFloat(setting.value) : 10;
    return isNaN(rate) ? 10 : Math.min(Math.max(rate, 0), 100);
  }

  /**
   * Routes platform commission to the first super_admin, then first admin.
   * No-op (with a warning) if no admin wallet exists — commission is not lost,
   * it simply remains unassigned until an admin is created.
   */
  private async creditPlatformCommission(tx: postgres.Sql, commission: number): Promise<void> {
    const [adminUser] = await tx`
      SELECT id FROM users WHERE role IN ('super_admin', 'admin') ORDER BY role DESC, created_at ASC LIMIT 1
    `;
    if (!adminUser) {
      this.logger.warn(`creditPlatformCommission: no admin user found — commission of ${commission} JOD not credited`);
      return;
    }
    await tx`
      INSERT INTO wallets (user_id, balance, total_earned)
      VALUES (${adminUser.id}, ${commission}, ${commission})
      ON CONFLICT (user_id) DO UPDATE
        SET balance      = wallets.balance + ${commission},
            total_earned = wallets.total_earned + ${commission}
    `;
  }

  // ─── FUND: GIG ORDER ─────────────────────────────────────────
  // Idempotent — safe to call multiple times for the same order
  async fundOrder(orderId: string, stripePaymentIntentId: string): Promise<void> {
    const [existing] = await this.sql`
      SELECT id, status FROM escrow_accounts
      WHERE order_id = ${orderId} AND status IN ('funded','released','disputed','refunded')
    `;
    if (existing) {
      this.logger.warn(`fundOrder: escrow already ${existing.status} for order ${orderId}`);
      return;
    }

    const [order] = await this.sql`
      SELECT id, client_id, freelancer_id, price, commission_amount, freelancer_amount, status
      FROM orders WHERE id = ${orderId}
    `;
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.status !== 'pending') {
      this.logger.warn(`fundOrder: order ${orderId} status='${order.status}', expected 'pending'`);
      return;
    }

    const amount        = Number(order.price);
    const commissionRate = await this.getCommissionRate();
    const commission = Number(order.commission_amount) || Math.round(amount * (commissionRate / 100) * 1000) / 1000;
    const netAmount  = Number(order.freelancer_amount) || Math.round((amount - commission) * 1000) / 1000;

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      const [escrow] = await tx`
        INSERT INTO escrow_accounts
          (order_id, client_id, freelancer_id, amount, commission, net_amount,
           stripe_payment_intent_id, status)
        VALUES (${orderId}, ${order.client_id}, ${order.freelancer_id},
                ${amount}, ${commission}, ${netAmount}, ${stripePaymentIntentId}, 'funded')
        RETURNING id
      `;

      await tx`
        UPDATE orders SET status = 'in_progress', started_at = NOW()
        WHERE id = ${orderId}
      `;

      await tx`
        UPDATE wallets SET pending_balance = pending_balance + ${netAmount}
        WHERE user_id = ${order.freelancer_id}
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, order_id, from_user_id, type, amount, status,
           stripe_payment_intent_id, description_en, description_ar)
        VALUES (${escrow.id}, ${orderId}, ${order.client_id},
                'deposit', ${amount}, 'completed', ${stripePaymentIntentId},
                'Gig order payment held in escrow',
                'دفعة الطلب محتجزة في الضمان')
      `;
    });

    this.logger.log(`Funded escrow for order ${orderId} — ${amount} JOD (commission: ${commissionRate}%)`);
  }

  // ─── FUND: MILESTONE ─────────────────────────────────────────
  async fundMilestone(milestoneId: string, stripePaymentIntentId: string): Promise<void> {
    const [existing] = await this.sql`
      SELECT id FROM escrow_accounts
      WHERE milestone_id = ${milestoneId} AND status IN ('funded','released','disputed','refunded')
    `;
    if (existing) {
      this.logger.warn(`fundMilestone: escrow already exists for milestone ${milestoneId}`);
      return;
    }

    const [ms] = await this.sql`
      SELECT m.*, c.client_id, c.freelancer_id
      FROM milestones m JOIN contracts c ON c.id = m.contract_id
      WHERE m.id = ${milestoneId}
    `;
    if (!ms) throw new NotFoundException(`Milestone ${milestoneId} not found`);

    const amount         = Number(ms.amount);
    const commissionRate = await this.getCommissionRate();
    const commission     = Math.round(amount * (commissionRate / 100) * 1000) / 1000;
    const netAmount      = Math.round((amount - commission) * 1000) / 1000;

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      const [escrow] = await tx`
        INSERT INTO escrow_accounts
          (milestone_id, contract_id, client_id, freelancer_id,
           amount, commission, net_amount, stripe_payment_intent_id, status)
        VALUES (${milestoneId}, ${ms.contract_id}, ${ms.client_id}, ${ms.freelancer_id},
                ${amount}, ${commission}, ${netAmount}, ${stripePaymentIntentId}, 'funded')
        RETURNING id
      `;

      await tx`UPDATE milestones SET status = 'in_progress' WHERE id = ${milestoneId}`;

      await tx`
        UPDATE wallets SET pending_balance = pending_balance + ${netAmount}
        WHERE user_id = ${ms.freelancer_id}
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, milestone_id, from_user_id, type, amount, status,
           stripe_payment_intent_id, description_en, description_ar)
        VALUES (${escrow.id}, ${milestoneId}, ${ms.client_id},
                'deposit', ${amount}, 'completed', ${stripePaymentIntentId},
                'Milestone payment held in escrow',
                'دفعة المرحلة محتجزة في الضمان')
      `;
    });

    this.logger.log(`Funded escrow for milestone ${milestoneId} — ${amount} JOD (commission: ${commissionRate}%)`);
  }

  // ─── FUND FROM LOCAL/COD (admin confirmed) — use existing pending transaction ─
  async fundOrderFromLocalTransaction(transactionId: string): Promise<void> {
    const [tx] = await this.sql`
      SELECT id, order_id, from_user_id, amount
      FROM transactions
      WHERE id = ${transactionId} AND status = 'pending' AND type = 'deposit' AND order_id IS NOT NULL
    `;
    if (!tx) throw new NotFoundException('Pending order transaction not found');
    const orderId = tx.order_id;

    const [existing] = await this.sql`
      SELECT id, status FROM escrow_accounts
      WHERE order_id = ${orderId} AND status IN ('funded','released','disputed','refunded')
    `;
    if (existing) {
      this.logger.warn(`fundOrderFromLocalTransaction: escrow already ${existing.status} for order ${orderId}`);
      await this.sql`
        UPDATE transactions SET status = 'completed', updated_at = NOW()
        WHERE id = ${transactionId}
      `;
      return;
    }

    const [order] = await this.sql`
      SELECT id, client_id, freelancer_id, price, commission_amount, freelancer_amount, status
      FROM orders WHERE id = ${orderId}
    `;
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.status !== 'pending') {
      this.logger.warn(`fundOrderFromLocalTransaction: order ${orderId} status='${order.status}'`);
      return;
    }

    const amount         = Number(order.price);
    const commissionRate = await this.getCommissionRate();
    const commission     = Number(order.commission_amount) || Math.round(amount * (commissionRate / 100) * 1000) / 1000;
    const netAmount      = Number(order.freelancer_amount) || Math.round((amount - commission) * 1000) / 1000;
    const localRef       = `local-${transactionId}`;

    await (this.sql as any).begin(async (txSql: postgres.Sql) => {
      const [escrow] = await txSql`
        INSERT INTO escrow_accounts
          (order_id, client_id, freelancer_id, amount, commission, net_amount,
           stripe_payment_intent_id, status)
        VALUES (${orderId}, ${order.client_id}, ${order.freelancer_id},
                ${amount}, ${commission}, ${netAmount}, ${localRef}, 'funded')
        RETURNING id
      `;

      await txSql`UPDATE orders SET status = 'in_progress', started_at = NOW() WHERE id = ${orderId}`;

      await txSql`
        UPDATE wallets SET pending_balance = pending_balance + ${netAmount}
        WHERE user_id = ${order.freelancer_id}
      `;

      await txSql`
        UPDATE transactions SET escrow_id = ${escrow.id}, status = 'completed', updated_at = NOW()
        WHERE id = ${transactionId}
      `;
    });

    this.logger.log(`Funded escrow for order ${orderId} from local transaction ${transactionId}`);
  }

  async fundMilestoneFromLocalTransaction(transactionId: string): Promise<void> {
    const [tx] = await this.sql`
      SELECT id, milestone_id, from_user_id, amount
      FROM transactions
      WHERE id = ${transactionId} AND status = 'pending' AND type = 'deposit' AND milestone_id IS NOT NULL
    `;
    if (!tx) throw new NotFoundException('Pending milestone transaction not found');
    const milestoneId = tx.milestone_id;

    const [existing] = await this.sql`
      SELECT id FROM escrow_accounts
      WHERE milestone_id = ${milestoneId} AND status IN ('funded','released','disputed','refunded')
    `;
    if (existing) {
      this.logger.warn(`fundMilestoneFromLocalTransaction: escrow already exists for milestone ${milestoneId}`);
      await this.sql`
        UPDATE transactions SET status = 'completed', updated_at = NOW()
        WHERE id = ${transactionId}
      `;
      return;
    }

    const [ms] = await this.sql`
      SELECT m.*, c.client_id, c.freelancer_id
      FROM milestones m JOIN contracts c ON c.id = m.contract_id
      WHERE m.id = ${milestoneId}
    `;
    if (!ms) throw new NotFoundException(`Milestone ${milestoneId} not found`);

    const amount         = Number(ms.amount);
    const commissionRate = await this.getCommissionRate();
    const commission     = Math.round(amount * (commissionRate / 100) * 1000) / 1000;
    const netAmount      = Math.round((amount - commission) * 1000) / 1000;
    const localRef       = `local-${transactionId}`;

    await (this.sql as any).begin(async (txSql: postgres.Sql) => {
      const [escrow] = await txSql`
        INSERT INTO escrow_accounts
          (milestone_id, contract_id, client_id, freelancer_id,
           amount, commission, net_amount, stripe_payment_intent_id, status)
        VALUES (${milestoneId}, ${ms.contract_id}, ${ms.client_id}, ${ms.freelancer_id},
                ${amount}, ${commission}, ${netAmount}, ${localRef}, 'funded')
        RETURNING id
      `;

      await txSql`UPDATE milestones SET status = 'in_progress' WHERE id = ${milestoneId}`;

      await txSql`
        UPDATE wallets SET pending_balance = pending_balance + ${netAmount}
        WHERE user_id = ${ms.freelancer_id}
      `;

      await txSql`
        UPDATE transactions SET escrow_id = ${escrow.id}, status = 'completed', updated_at = NOW()
        WHERE id = ${transactionId}
      `;
    });

    this.logger.log(`Funded escrow for milestone ${milestoneId} from local transaction ${transactionId}`);
  }

  // ─── RELEASE: GIG ORDER ──────────────────────────────────────
  async releaseForOrder(orderId: string): Promise<void> {
    const [escrow] = await this.sql`
      SELECT * FROM escrow_accounts
      WHERE order_id = ${orderId} AND status = 'funded'
    `;
    if (!escrow) {
      this.logger.warn(`releaseForOrder: no funded escrow for order ${orderId}`);
      return;
    }

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE escrow_accounts SET status = 'released', released_at = NOW()
        WHERE id = ${escrow.id}
      `;

      await tx`
        UPDATE wallets SET
          balance         = balance + ${escrow.net_amount},
          total_earned    = total_earned + ${escrow.net_amount},
          pending_balance = GREATEST(0, pending_balance - ${escrow.net_amount})
        WHERE user_id = ${escrow.freelancer_id}
      `;

      await this.creditPlatformCommission(tx, Number(escrow.commission));

      await tx`
        UPDATE profiles SET
          total_earned     = total_earned + ${escrow.net_amount},
          completed_orders = COALESCE(completed_orders, 0) + 1
        WHERE user_id = ${escrow.freelancer_id}
      `;
      await tx`
        UPDATE profiles SET total_spent = total_spent + ${escrow.amount}
        WHERE user_id = ${escrow.client_id}
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, order_id, from_user_id, to_user_id, type, amount, status,
           description_en, description_ar)
        VALUES (${escrow.id}, ${escrow.order_id}, ${escrow.client_id}, ${escrow.freelancer_id},
                'release', ${escrow.net_amount}, 'completed',
                'Payment released to freelancer after order completion',
                'تم اصدار الدفعة للمستقل بعد اتمام الطلب')
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, order_id, from_user_id, type, amount, status,
           description_en, description_ar)
        VALUES (${escrow.id}, ${escrow.order_id}, ${escrow.client_id},
                'commission', ${escrow.commission}, 'completed',
                'Platform commission', 'عمولة المنصة')
      `;
    });

    this.logger.log(
      `Released escrow for order ${orderId} — net: ${escrow.net_amount}, commission: ${escrow.commission} JOD`,
    );
  }

  // ─── RELEASE: MILESTONE ──────────────────────────────────────
  async releaseForMilestone(milestoneId: string): Promise<void> {
    const [escrow] = await this.sql`
      SELECT * FROM escrow_accounts
      WHERE milestone_id = ${milestoneId} AND status = 'funded'
    `;
    if (!escrow) {
      this.logger.warn(`releaseForMilestone: no funded escrow for milestone ${milestoneId}`);
      return;
    }

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE escrow_accounts SET status = 'released', released_at = NOW()
        WHERE id = ${escrow.id}
      `;

      await tx`
        UPDATE wallets SET
          balance         = balance + ${escrow.net_amount},
          total_earned    = total_earned + ${escrow.net_amount},
          pending_balance = GREATEST(0, pending_balance - ${escrow.net_amount})
        WHERE user_id = ${escrow.freelancer_id}
      `;

      await this.creditPlatformCommission(tx, Number(escrow.commission));

      await tx`
        UPDATE profiles SET total_earned = total_earned + ${escrow.net_amount}
        WHERE user_id = ${escrow.freelancer_id}
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, milestone_id, from_user_id, to_user_id, type, amount, status,
           description_en, description_ar)
        VALUES (${escrow.id}, ${milestoneId}, ${escrow.client_id}, ${escrow.freelancer_id},
                'release', ${escrow.net_amount}, 'completed',
                'Milestone payment released', 'تم اصدار دفعة المرحلة')
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, milestone_id, from_user_id, type, amount, status,
           description_en, description_ar)
        VALUES (${escrow.id}, ${milestoneId}, ${escrow.client_id},
                'commission', ${escrow.commission}, 'completed',
                'Platform commission', 'عمولة المنصة')
      `;
    });

    this.logger.log(`Released escrow for milestone ${milestoneId}`);
  }

  // ─── REFUND (cancellation, no Stripe API call) ───────────────
  async refundEscrow(orderId?: string, milestoneId?: string): Promise<void> {
    const condition = orderId
      ? this.sql`order_id = ${orderId}`
      : this.sql`milestone_id = ${milestoneId!}`;

    const [escrow] = await this.sql`
      SELECT * FROM escrow_accounts WHERE ${condition} AND status = 'funded'
    `;
    if (!escrow) return;

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE escrow_accounts SET status = 'refunded', refunded_at = NOW()
        WHERE id = ${escrow.id}
      `;

      await tx`
        UPDATE wallets
        SET pending_balance = GREATEST(0, pending_balance - ${escrow.net_amount})
        WHERE user_id = ${escrow.freelancer_id}
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, from_user_id, type, amount, status, description_en, description_ar)
        VALUES (${escrow.id}, ${escrow.client_id},
                'refund', ${escrow.amount}, 'completed',
                'Refund issued — order cancelled', 'تم الاسترداد — الطلب ملغى')
      `;
    });

    this.logger.log(`Refunded escrow ${escrow.id} — ${escrow.amount} JOD`);
  }

  // ─── DISPUTE: FREEZE ─────────────────────────────────────────
  async disputeEscrow(orderId?: string, milestoneId?: string): Promise<void> {
    const condition = orderId
      ? this.sql`order_id = ${orderId}`
      : this.sql`milestone_id = ${milestoneId!}`;

    await this.sql`
      UPDATE escrow_accounts
      SET status = 'disputed', disputed_at = NOW()
      WHERE ${condition} AND status = 'funded'
    `;

    this.logger.log(`Escrow disputed for order=${orderId ?? '-'} milestone=${milestoneId ?? '-'}`);
  }

  // ─── ADMIN: RESOLVE DISPUTE ──────────────────────────────────
  async resolveDispute(
    escrowId: string,
    resolution: 'release_to_freelancer' | 'refund_to_client',
  ): Promise<void> {
    const [escrow] = await this.sql`
      SELECT * FROM escrow_accounts WHERE id = ${escrowId} AND status = 'disputed'
    `;
    if (!escrow) throw new NotFoundException('Disputed escrow not found');

    // Restore to funded so helpers work
    await this.sql`UPDATE escrow_accounts SET status = 'funded' WHERE id = ${escrowId}`;

    if (resolution === 'release_to_freelancer') {
      if (escrow.order_id)     await this.releaseForOrder(escrow.order_id);
      if (escrow.milestone_id) await this.releaseForMilestone(escrow.milestone_id);
    } else {
      await this.refundEscrow(escrow.order_id ?? undefined, escrow.milestone_id ?? undefined);
    }
  }

  // ─── ADMIN: PARTIAL SPLIT ────────────────────────────────────
  /**
   * Split a disputed escrow between client and freelancer.
   * clientPct + freelancerPct must equal 100.
   * The platform still takes its commission from the gross amount;
   * the remainder is divided by the specified percentages.
   */
  async partialSplit(
    escrowId: string,
    clientPct: number,
    freelancerPct: number,
  ): Promise<void> {
    if (Math.round(clientPct + freelancerPct) !== 100) {
      throw new Error('clientPct + freelancerPct must equal 100');
    }

    const [escrow] = await this.sql`
      SELECT * FROM escrow_accounts WHERE id = ${escrowId}
    `;
    if (!escrow) throw new NotFoundException('Escrow not found');

    const net        = Number(escrow.net_amount);
    const commission = Number(escrow.commission);
    const toFreelancer = Math.round(net * (freelancerPct / 100) * 1000) / 1000;
    const toClient     = Math.round(net * (clientPct     / 100) * 1000) / 1000;

    await (this.sql as any).begin(async (tx: postgres.Sql) => {
      await tx`
        UPDATE escrow_accounts SET status = 'released', released_at = NOW()
        WHERE id = ${escrow.id}
      `;

      // Credit freelancer share
      if (toFreelancer > 0) {
        await tx`
          UPDATE wallets SET
            balance         = balance + ${toFreelancer},
            total_earned    = total_earned + ${toFreelancer},
            pending_balance = GREATEST(0, pending_balance - ${net})
          WHERE user_id = ${escrow.freelancer_id}
        `;
        await tx`
          UPDATE profiles SET total_earned = total_earned + ${toFreelancer}
          WHERE user_id = ${escrow.freelancer_id}
        `;
      }

      // Credit client refund share
      if (toClient > 0) {
        await tx`
          INSERT INTO transactions
            (escrow_id, from_user_id, type, amount, status, description_en, description_ar)
          VALUES (${escrow.id}, ${escrow.client_id},
                  'refund', ${toClient}, 'completed',
                  'Partial refund — dispute split', 'استرداد جزئي — تسوية النزاع')
        `;
        await tx`
          UPDATE profiles SET total_spent = total_spent + ${toClient}
          WHERE user_id = ${escrow.client_id}
        `;
      }

      // Platform commission
      await this.creditPlatformCommission(tx, commission);

      await tx`
        INSERT INTO transactions
          (escrow_id, from_user_id, to_user_id, type, amount, status, description_en, description_ar)
        VALUES (${escrow.id}, ${escrow.client_id}, ${escrow.freelancer_id},
                'release', ${toFreelancer}, 'completed',
                ${`Dispute split — freelancer ${freelancerPct}% / client ${clientPct}%`},
                ${`تسوية نزاع — مستقل ${freelancerPct}% / عميل ${clientPct}%`})
      `;

      await tx`
        INSERT INTO transactions
          (escrow_id, from_user_id, type, amount, status, description_en, description_ar)
        VALUES (${escrow.id}, ${escrow.client_id},
                'commission', ${commission}, 'completed',
                'Platform commission', 'عمولة المنصة')
      `;
    });

    this.logger.log(
      `Partial split escrow ${escrow.id} — freelancer ${freelancerPct}% (${toFreelancer} JOD), client ${clientPct}% (${toClient} JOD)`,
    );
  }

  // ─── QUERIES ─────────────────────────────────────────────────
  async getEscrowByOrder(orderId: string) {
    const [e] = await this.sql`
      SELECT ea.*, fp.full_name_en AS freelancer_name, cp.full_name_en AS client_name
      FROM escrow_accounts ea
      JOIN profiles fp ON fp.user_id = ea.freelancer_id
      JOIN profiles cp ON cp.user_id = ea.client_id
      WHERE ea.order_id = ${orderId}
    `;
    return e;
  }

  async getEscrowByMilestone(milestoneId: string) {
    const [e] = await this.sql`
      SELECT * FROM escrow_accounts WHERE milestone_id = ${milestoneId}
    `;
    return e;
  }

  async getPendingEscrows() {
    return this.sql`
      SELECT ea.*, fp.full_name_en AS freelancer_name
      FROM escrow_accounts ea
      JOIN profiles fp ON fp.user_id = ea.freelancer_id
      WHERE ea.status IN ('funded', 'disputed')
      ORDER BY ea.created_at ASC
    `;
  }
}
