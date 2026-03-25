import {
  Injectable, BadRequestException, NotFoundException, Inject, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { EscrowService } from '../escrow/escrow.service';
import { NotificationsService } from '../notifications/notifications.service';

// Manual (local) deposits support CliQ only.
// Stripe card payments are handled separately via createGigCheckout / createMilestoneCheckout.
const LOCAL_PAYMENT_METHODS = ['cliq'] as const;

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private config: ConfigService,
    private escrow: EscrowService,
    private notifications: NotificationsService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe checkout disabled');
    }
  }

  private getStripe(): Stripe {
    if (!this.stripe) throw new BadRequestException('Card payments are not available. Use a local payment method.');
    return this.stripe;
  }

  private buildPaymentInstructions(
    method: string,
    amount: number,
    referenceNumber: string,
  ): { instructions_en: string; instructions_ar: string; details?: Record<string, string> } {
    // Only CliQ is supported for manual deposits
    if (method === 'cliq') {
      return {
        instructions_en: `Send ${amount.toFixed(2)} JOD via CliQ to the alias below, then upload your receipt. Reference: ${referenceNumber}`,
        instructions_ar: `أرسل ${amount.toFixed(2)} د.أ عبر CliQ إلى المعرف أدناه، ثم ارفع إيصالك. المرجع: ${referenceNumber}`,
        details: {
          cliq_alias: this.config.get('CLIQ_ALIAS') || 'DOPAWORK.JO',
          account_name: this.config.get('CLIQ_NAME') || 'Dopa Work',
          reference: referenceNumber,
        },
      };
    }
    return {
      instructions_en: `Complete payment (${amount.toFixed(2)} JOD). Reference: ${referenceNumber}`,
      instructions_ar: `أكمل الدفع (${amount.toFixed(2)} د.أ). المرجع: ${referenceNumber}`,
    };
  }

  // ─── CHECKOUT: GIG ORDER ─────────────────────────────────────
  async createGigCheckout(clientId: string, dto: { order_id: string }) {
    // Require email verification before any payment (bypassed in development)
    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    if (!isDev) {
      const [clientCheck] = await this.sql`SELECT email_verified FROM users WHERE id = ${clientId}`;
      if (!clientCheck?.email_verified) {
        throw new BadRequestException('You must verify your email before making a payment');
      }
    }

    const [order] = await this.sql`
      SELECT o.*, g.title_en, g.title_ar
      FROM orders o JOIN gigs g ON g.id = o.gig_id
      WHERE o.id = ${dto.order_id} AND o.client_id = ${clientId} AND o.status = 'pending'
    `;
    if (!order) throw new NotFoundException('Order not found or already paid');

    // JOD uses 3 decimal places (fils). Stripe wants the smallest unit (integer fils).
    const amountFils = Math.round(Number(order.price) * 1000);

    const [clientUser] = await this.sql`SELECT email FROM users WHERE id = ${clientId}`;

    const session = await this.getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jod',
          product_data: {
            name:        order.title_en,
            description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
          },
          unit_amount: amountFils,
        },
        quantity: 1,
      }],
      mode:           'payment',
      customer_email: clientUser?.email,
      expires_at:     Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
      success_url:    `${this.config.get('FRONTEND_URL')}/orders/${order.id}?payment=success`,
      cancel_url:     `${this.config.get('FRONTEND_URL')}/orders/${order.id}?payment=cancelled`,
      metadata: {
        type:      'gig_order',
        order_id:  order.id,
        client_id: clientId,
      },
      payment_intent_data: {
        metadata: { order_id: order.id, platform: 'freelance-jo' },
      },
    });

    await this.sql`
      UPDATE orders SET stripe_session_id = ${session.id} WHERE id = ${order.id}
    `;

    return { checkout_url: session.url, session_id: session.id };
  }

  // ─── CHECKOUT: MILESTONE ─────────────────────────────────────
  async createMilestoneCheckout(clientId: string, dto: { milestone_id: string }) {
    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    if (!isDev) {
      const [clientCheck] = await this.sql`SELECT email_verified FROM users WHERE id = ${clientId}`;
      if (!clientCheck?.email_verified) {
        throw new BadRequestException('You must verify your email before making a payment');
      }
    }

    const [ms] = await this.sql`
      SELECT m.*, c.client_id, c.freelancer_id
      FROM milestones m JOIN contracts c ON c.id = m.contract_id
      WHERE m.id = ${dto.milestone_id} AND m.status = 'pending'
    `;
    if (!ms) throw new NotFoundException('Milestone not found or already funded');
    if (ms.client_id !== clientId) throw new BadRequestException('Access denied');

    const amountFils = Math.round(Number(ms.amount) * 1000);
    const [clientUser] = await this.sql`SELECT email FROM users WHERE id = ${clientId}`;

    const session = await this.getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jod',
          product_data: {
            name:        `Milestone: ${ms.title_en}`,
            description: 'Contract milestone funding',
          },
          unit_amount: amountFils,
        },
        quantity: 1,
      }],
      mode:           'payment',
      customer_email: clientUser?.email,
      expires_at:     Math.floor(Date.now() / 1000) + 30 * 60,
      success_url:    `${this.config.get('FRONTEND_URL')}/contracts/${ms.contract_id}?payment=success`,
      cancel_url:     `${this.config.get('FRONTEND_URL')}/contracts/${ms.contract_id}?payment=cancelled`,
      metadata: {
        type:         'milestone',
        milestone_id: ms.id,
        client_id:    clientId,
      },
    });

    await this.sql`
      UPDATE milestones SET stripe_session_id = ${session.id} WHERE id = ${ms.id}
    `;

    return { checkout_url: session.url, session_id: session.id };
  }

  // ─── STRIPE WEBHOOK ──────────────────────────────────────────
  // rawBody MUST be the raw Buffer — requires rawBody:true in NestFactory.create
  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe event: ${event.type} (${event.id})`);

    // Idempotency guard — skip duplicate deliveries
    const alreadyProcessed = await this.markEventProcessed(event.id);
    if (alreadyProcessed) {
      this.logger.warn(`Stripe event ${event.id} already processed — skipping`);
      return { received: true };
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'payment_intent.succeeded':
          await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.onPaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'checkout.session.expired':
          await this.onCheckoutExpired(event.data.object as Stripe.Checkout.Session);
          break;
        default:
          this.logger.debug(`Unhandled event: ${event.type}`);
      }
    } catch (err: any) {
      this.logger.error(`Error handling Stripe event ${event.id}: ${err.message}`, err.stack);
      throw err; // Throw so Stripe retries
    }

    return { received: true };
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { type, order_id, milestone_id } = session.metadata ?? {};
    const paymentIntentId = session.payment_intent as string;

    if (type === 'gig_order' && order_id) {
      await this.escrow.fundOrder(order_id, paymentIntentId);
      await this.notifyPaymentSuccess(order_id, null);
    }

    if (type === 'milestone' && milestone_id) {
      await this.escrow.fundMilestone(milestone_id, paymentIntentId);
      await this.notifyPaymentSuccess(null, milestone_id);
    }
  }

  private async onPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
    const { order_id } = pi.metadata ?? {};
    if (!order_id) return;

    // Only act if checkout.session.completed did not already handle it
    const [order] = await this.sql`SELECT status FROM orders WHERE id = ${order_id}`;
    if (order?.status === 'pending') {
      this.logger.log(`payment_intent.succeeded fallback for order ${order_id}`);
      await this.escrow.fundOrder(order_id, pi.id);
    }
  }

  private async onPaymentFailed(pi: Stripe.PaymentIntent) {
    const { order_id } = pi.metadata ?? {};
    this.logger.warn(`Payment failed — PI: ${pi.id}, order: ${order_id ?? 'unknown'}`);

    if (order_id) {
      const [order] = await this.sql`SELECT client_id FROM orders WHERE id = ${order_id}`;
      if (order) {
        await this.notifications.create({
          userId:      order.client_id,
          type:        'payment_failed',
          title_en:    'Payment Failed',
          title_ar:    'فشل الدفع',
          body_en:     'Your payment could not be processed. Please try again.',
          body_ar:     'تعذر معالجة دفعتك. يرجى المحاولة مرة اخرى.',
          entity_type: 'order',
          entity_id:   order_id,
        });
      }
    }
  }

  private async onCheckoutExpired(session: Stripe.Checkout.Session) {
    const { type, order_id } = session.metadata ?? {};
    this.logger.warn(`Checkout expired — type: ${type}, order: ${order_id}`);

    if (type === 'gig_order' && order_id) {
      await this.sql`
        UPDATE orders SET stripe_session_id = NULL
        WHERE id = ${order_id} AND status = 'pending'
      `;
    }
  }

  // ─── STRIPE REFUND ───────────────────────────────────────────
  // Issues actual money-back via Stripe API. Call AFTER escrow.refundEscrow().
  async issueStripeRefund(orderId: string, reason = 'requested_by_customer'): Promise<void> {
    const [escrow] = await this.sql`
      SELECT stripe_payment_intent_id, amount
      FROM escrow_accounts
      WHERE order_id = ${orderId}
        AND status IN ('refunded', 'disputed')
        AND stripe_payment_intent_id IS NOT NULL
    `;
    if (!escrow) {
      this.logger.warn(`issueStripeRefund: no payment intent found for order ${orderId}`);
      return;
    }

    try {
      const refund = await this.getStripe().refunds.create({
        payment_intent: escrow.stripe_payment_intent_id,
        amount:         Math.round(Number(escrow.amount) * 1000),
        reason:         reason as Stripe.RefundCreateParams.Reason,
        metadata:       { order_id: orderId, platform: 'freelance-jo' },
      });

      await this.sql`
        UPDATE escrow_accounts
        SET stripe_refund_id = ${refund.id}
        WHERE order_id = ${orderId}
      `;

      this.logger.log(`Stripe refund ${refund.id} issued for order ${orderId}`);
    } catch (err: any) {
      this.logger.error(`Stripe refund failed for order ${orderId}: ${err.message}`);
      throw new BadRequestException(`Stripe refund error: ${err.message}`);
    }
  }

  // ─── AUTO-RELEASE CRON ───────────────────────────────────────
  // Auto-complete orders in 'delivered' state for more than 3 days.
  // Protects freelancers from clients who go silent after delivery.
  @Cron(CronExpression.EVERY_HOUR)
  async autoReleaseStaleOrders(): Promise<void> {
    const stale = await this.sql`
      SELECT o.id
      FROM orders o
      JOIN escrow_accounts ea ON ea.order_id = o.id
      WHERE o.status = 'delivered'
        AND ea.status = 'funded'
        AND o.delivered_at < NOW() - INTERVAL '3 days'
    `;

    if (stale.length === 0) return;

    for (const order of stale) {
      try {
        await this.sql`
          UPDATE orders
          SET status = 'completed', completed_at = NOW(), auto_completed = TRUE
          WHERE id = ${order.id}
        `;
        await this.escrow.releaseForOrder(order.id);

        const [o] = await this.sql`
          SELECT freelancer_id, client_id FROM orders WHERE id = ${order.id}
        `;

        await this.notifications.create({
          userId:      o.freelancer_id,
          type:        'order_completed',
          title_en:    'Payment Auto-Released',
          title_ar:    'تم اصدار الدفعة تلقائيا',
          body_en:     'Your order was auto-completed after 3 days. Payment released to your wallet.',
          body_ar:     'تم اكمال طلبك تلقائيا بعد 3 ايام. الدفعة في محفظتك.',
          entity_type: 'order',
          entity_id:   order.id,
        });

        this.logger.log(`Auto-released order ${order.id}`);
      } catch (err: any) {
        this.logger.error(`Auto-release failed for order ${order.id}: ${err.message}`);
      }
    }

    this.logger.log(`Auto-released ${stale.length} stale order(s)`);
  }

  // ─── TRANSACTIONS ────────────────────────────────────────────
  async getMyTransactions(userId: string) {
    return this.sql`
      SELECT
        t.id, t.type, t.amount, t.status,
        t.description_en, t.description_ar,
        t.created_at, t.order_id, t.milestone_id,
        fu.email AS from_email,
        tu.email AS to_email
      FROM transactions t
      LEFT JOIN users fu ON fu.id = t.from_user_id
      LEFT JOIN users tu ON tu.id = t.to_user_id
      WHERE t.from_user_id = ${userId} OR t.to_user_id = ${userId}
      ORDER BY t.created_at DESC
      LIMIT 100
    `;
  }

  async getTransactionById(id: string, userId: string) {
    const [t] = await this.sql`
      SELECT t.*, fu.email AS from_email, tu.email AS to_email
      FROM transactions t
      LEFT JOIN users fu ON fu.id = t.from_user_id
      LEFT JOIN users tu ON tu.id = t.to_user_id
      WHERE t.id = ${id}
        AND (t.from_user_id = ${userId} OR t.to_user_id = ${userId})
    `;
    if (!t) throw new NotFoundException('Transaction not found');
    return t;
  }

  // ─── LOCAL / COD: initiate pending payment ──────────────────
  async initiateLocalPayment(
    clientId: string,
    dto: { order_id?: string; milestone_id?: string; payment_method: string; user_reference?: string; proof_image_url?: string },
  ) {
    const hasOrder = !!dto.order_id;
    const hasMilestone = !!dto.milestone_id;
    if ((hasOrder && hasMilestone) || (!hasOrder && !hasMilestone)) {
      throw new BadRequestException('Provide exactly one of order_id or milestone_id');
    }
    if (!LOCAL_PAYMENT_METHODS.includes(dto.payment_method as any)) {
      throw new BadRequestException('Invalid local payment method');
    }

    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    if (!isDev) {
      const [clientCheck] = await this.sql`SELECT email_verified FROM users WHERE id = ${clientId}`;
      if (!clientCheck?.email_verified) {
        throw new BadRequestException('You must verify your email before making a payment');
      }
    }

    let amount = 0;
    let orderId: string | null = null;
    let milestoneId: string | null = null;
    let descEn = '';
    let descAr = '';

    if (dto.order_id) {
      const [order] = await this.sql`
        SELECT o.id, o.price
        FROM orders o
        WHERE o.id = ${dto.order_id} AND o.client_id = ${clientId} AND o.status = 'pending'
      `;
      if (!order) throw new NotFoundException('Order not found or already paid');
      amount = Number(order.price);
      orderId = order.id;
      descEn = 'Gig order payment (pending confirmation)';
      descAr = 'دفعة طلب (في انتظار التأكيد)';
    } else {
      const [ms] = await this.sql`
        SELECT m.id, m.amount, c.client_id
        FROM milestones m JOIN contracts c ON c.id = m.contract_id
        WHERE m.id = ${dto.milestone_id!} AND m.status = 'pending'
      `;
      if (!ms || ms.client_id !== clientId) throw new NotFoundException('Milestone not found or already funded');
      amount = Number(ms.amount);
      milestoneId = ms.id;
      descEn = 'Milestone payment (pending confirmation)';
      descAr = 'دفعة مرحلة (في انتظار التأكيد)';
    }

    const refNum = `LOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const instructions = this.buildPaymentInstructions(dto.payment_method, amount, refNum);

    const proofMeta = {
      user_reference:  dto.user_reference  || null,
      proof_image_url: dto.proof_image_url || null,
    };

    const [tx] = await this.sql`
      INSERT INTO transactions
        (order_id, milestone_id, from_user_id, type, amount, status, payment_method,
         description_en, description_ar, payment_instructions, reference_number, metadata)
      VALUES
        (${orderId}, ${milestoneId}, ${clientId}, 'deposit', ${amount}, 'pending', ${dto.payment_method},
         ${descEn}, ${descAr}, ${JSON.stringify(instructions)}, ${refNum}, ${JSON.stringify(proofMeta)})
      RETURNING id, reference_number, payment_instructions, amount, payment_method, order_id, milestone_id, metadata, created_at
    `;

    return {
      transaction_id: tx.id,
      reference_number: tx.reference_number,
      payment_instructions: tx.payment_instructions,
      amount: Number(tx.amount),
      payment_method: tx.payment_method,
      order_id: tx.order_id,
      milestone_id: tx.milestone_id,
      created_at: tx.created_at,
      message: 'Send the exact amount via CliQ using the instructions above. Admin will confirm once receipt is verified.',
    };
  }

  // ─── ADMIN: ALL PENDING DEPOSITS ─────────────────────────────
  async adminGetPendingDeposits() {
    return this.sql`
      SELECT
        t.id, t.amount, t.payment_method, t.status,
        t.reference_number, t.metadata, t.created_at,
        t.order_id, t.milestone_id,
        u.email AS client_email,
        p.full_name_en AS client_name,
        t.payment_instructions
      FROM transactions t
      JOIN users    u ON u.id = t.from_user_id
      LEFT JOIN profiles p ON p.user_id = t.from_user_id
      WHERE t.type = 'deposit' AND t.status = 'pending'
      ORDER BY t.created_at ASC
    `;
  }

  async getMyPending(userId: string) {
    const rows = await this.sql`
      SELECT id, order_id, milestone_id, amount, payment_method, status,
             payment_instructions, reference_number, metadata, created_at
      FROM transactions
      WHERE from_user_id = ${userId} AND type = 'deposit' AND status = 'pending'
      ORDER BY created_at DESC
    `;
    return rows.map((r: any) => ({
      ...r,
      amount: Number(r.amount),
      payment_instructions: r.payment_instructions || {},
    }));
  }

  async adminConfirmPayment(transactionId: string, adminId: string) {
    // Atomic claim — only one concurrent call can flip status from 'pending' to 'completed'
    // Using UPDATE ... WHERE status='pending' as a compare-and-swap to prevent double-funding
    const [claimed] = await this.sql`
      UPDATE transactions
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${transactionId} AND status = 'pending' AND type = 'deposit'
      RETURNING id, order_id, milestone_id, from_user_id
    `;
    if (!claimed) {
      // Check if the transaction exists at all, or was already processed
      const [tx] = await this.sql`SELECT id, status FROM transactions WHERE id = ${transactionId}`;
      if (!tx) throw new NotFoundException('Transaction not found');
      throw new BadRequestException('Transaction is not a pending deposit (already confirmed or wrong type)');
    }
    const tx = claimed;

    if (tx.order_id) {
      await this.escrow.fundOrderFromLocalTransaction(transactionId);
      await this.notifyPaymentSuccess(tx.order_id, null);
    } else if (tx.milestone_id) {
      await this.escrow.fundMilestoneFromLocalTransaction(transactionId);
      await this.notifyPaymentSuccess(null, tx.milestone_id);
    }

    await this.notifications.create({
      userId:      tx.from_user_id,
      type:        'payment_received',
      title_en:    'Payment Confirmed',
      title_ar:    'تم تأكيد الدفع',
      body_en:     'Your payment has been confirmed by admin. Funds are now in escrow.',
      body_ar:     'تم تأكيد دفعتك من قبل الإدارة. المبلغ محجوز الآن.',
      entity_type: 'transaction',
      entity_id:   transactionId,
    });

    return { message: 'Payment confirmed and escrow funded' };
  }

  // ─── HELPERS ─────────────────────────────────────────────────
  private async markEventProcessed(eventId: string): Promise<boolean> {
    // Reuse audit_logs as an idempotency table — unique entity_id = stripe event ID
    const result = await this.sql`
      INSERT INTO audit_logs (entity_type, entity_id, action, meta)
      VALUES ('stripe_event', ${eventId}, 'webhook_processed', '{}')
      ON CONFLICT (entity_type, entity_id, action) DO NOTHING
    `;
    return (result as any).count === 0;
  }

  private async notifyPaymentSuccess(orderId: string | null, milestoneId: string | null) {
    if (orderId) {
      const [o] = await this.sql`SELECT freelancer_id FROM orders WHERE id = ${orderId}`;
      if (o) {
        await this.notifications.create({
          userId:      o.freelancer_id,
          type:        'order_placed',
          title_en:    'Payment Received — Work Can Begin!',
          title_ar:    'تم استلام الدفع — يمكنك البدء!',
          body_en:     'The client has paid. Your order is now in progress.',
          body_ar:     'دفع العميل. طلبك قيد التنفيذ الان.',
          entity_type: 'order',
          entity_id:   orderId,
        });
      }
    }

    if (milestoneId) {
      const [ms] = await this.sql`
        SELECT c.freelancer_id FROM milestones m
        JOIN contracts c ON c.id = m.contract_id
        WHERE m.id = ${milestoneId}
      `;
      if (ms) {
        await this.notifications.create({
          userId:      ms.freelancer_id,
          type:        'payment_released',
          title_en:    'Milestone Funded — Start Working!',
          title_ar:    'تم تمويل المرحلة — ابدا العمل!',
          body_en:     'The client has funded this milestone.',
          body_ar:     'قام العميل بتمويل هذه المرحلة.',
          entity_type: 'milestone',
          entity_id:   milestoneId,
        });
      }
    }
  }
}
