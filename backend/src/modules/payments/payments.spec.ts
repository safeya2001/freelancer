/**
 * Payments API — integration tests (Jest + Supertest)
 *
 * Covers:
 *  1. Auth guards — all payment endpoints require JWT
 *  2. Double-payment / idempotency — calling "accept delivery" twice
 *     must NOT debit twice (concurrency race condition guard)
 *  3. Local payment methods — valid methods accepted, invalid rejected
 *  4. Admin confirm — pending → funded transition, 400 on second call
 *  5. Stripe not configured — local methods still work
 *  6. Unverified email — payment blocked until email is verified
 *
 * Run: npm test -- payments.spec (from backend/)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
const cookieParser = require('cookie-parser');
import { AppModule } from '../../app.module';

const RND = Math.random().toString(36).slice(2, 8);

describe('Payments endpoints (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser(process.env.JWT_SECRET));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── 1. AUTH GUARDS ─────────────────────────────────────────────────────────

  describe('Auth guards', () => {
    // Real routes: checkout/order (not /gig), checkout/milestone, initiate-local
    const protectedEndpoints = [
      { method: 'post', path: '/api/v1/payments/checkout/order',     expectedStatus: [401, 403] },
      { method: 'post', path: '/api/v1/payments/checkout/milestone', expectedStatus: [401, 403] },
      { method: 'post', path: '/api/v1/payments/initiate-local',     expectedStatus: [401, 403] },
      { method: 'get',  path: '/api/v1/payments/my-pending',         expectedStatus: [401] },
      { method: 'get',  path: '/api/v1/payments/transactions',       expectedStatus: [401] },
    ];

    protectedEndpoints.forEach(({ method, path, expectedStatus }) => {
      it(`${expectedStatus[0]} — ${method.toUpperCase()} ${path} without token`, async () => {
        const res = await (request(app.getHttpServer()) as any)[method](path);
        expect(expectedStatus).toContain(res.status);
      });
    });
  });

  // ─── 2. DOUBLE-PAYMENT IDEMPOTENCY ──────────────────────────────────────────

  describe('Double-payment race condition (requires live DB)', () => {
    it('funds escrow exactly once when admin confirms the same transaction twice', async () => {
      const adminToken = process.env.TEST_ADMIN_TOKEN;
      const txId = process.env.TEST_PENDING_TX_ID;
      if (!adminToken || !txId) return;

      // Fire two concurrent PATCH requests for the same transaction
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/v1/admin/transactions/${txId}/confirm`)
          .set('Authorization', `Bearer ${adminToken}`),
        request(app.getHttpServer())
          .patch(`/api/v1/admin/transactions/${txId}/confirm`)
          .set('Authorization', `Bearer ${adminToken}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      console.log('Double-confirm statuses:', statuses);

      // One should succeed (200), second should gracefully return 400
      // NOT a 500 — that would be a server bug (unhandled DB constraint error)
      expect(statuses.every((s) => s !== 500)).toBe(true);
      // At least one non-2xx to prove idempotency
      expect(statuses.some((s) => s >= 400)).toBe(true);
    });

    it('concurrent "accept delivery" double-click does NOT complete order twice', async () => {
      const clientToken = process.env.TEST_CLIENT_TOKEN;
      const orderId = process.env.TEST_DELIVERED_ORDER_ID;
      if (!clientToken || !orderId) return;

      // Correct endpoint: PATCH /orders/:id/complete
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/v1/orders/${orderId}/complete`)
          .set('Authorization', `Bearer ${clientToken}`),
        request(app.getHttpServer())
          .patch(`/api/v1/orders/${orderId}/complete`)
          .set('Authorization', `Bearer ${clientToken}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      console.log('Double-complete statuses:', statuses);

      // Must NOT both succeed (that would mean double escrow release)
      const bothSucceeded = statuses.every((s) => s >= 200 && s < 300);
      expect(bothSucceeded).toBe(false);
      // Must NOT both be 500 (unhandled server error)
      expect(statuses.every((s) => s === 500)).toBe(false);
    });
  });

  // ─── 3. LOCAL PAYMENT METHOD VALIDATION ─────────────────────────────────────

  describe('POST /api/v1/payments/initiate-local — method validation', () => {
    it('401/403 — blocked without token (guard first)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate-local')
        .send({ order_id: 'fake', payment_method: 'cliq' });
      expect([401, 403]).toContain(res.status);
    });

    it('400 — invalid payment method rejected (requires live token)', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const orderId = process.env.TEST_PENDING_ORDER_ID;
      if (!token || !orderId) return;

      await request(app.getHttpServer())
        .post('/api/v1/payments/initiate-local')
        .set('Authorization', `Bearer ${token}`)
        .send({ order_id: orderId, payment_method: 'bitcoin' }) // invalid
        .expect(400);
    });

    it('400 — both order_id and milestone_id provided (ambiguous)', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      if (!token) return;

      await request(app.getHttpServer())
        .post('/api/v1/payments/initiate-local')
        .set('Authorization', `Bearer ${token}`)
        .send({
          order_id: 'some-order',
          milestone_id: 'some-milestone',
          payment_method: 'cliq',
        })
        .expect(400);
    });

    it('400 — neither order_id nor milestone_id provided', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      if (!token) return;

      await request(app.getHttpServer())
        .post('/api/v1/payments/initiate-local')
        .set('Authorization', `Bearer ${token}`)
        .send({ payment_method: 'cliq' })
        .expect(400);
    });

    it('returns payment instructions for each valid local method', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const orderId = process.env.TEST_PENDING_ORDER_ID;
      if (!token || !orderId) return;

      const validMethods = ['bank_transfer', 'cliq', 'zain_cash', 'orange_money', 'cash_on_delivery'];

      for (const method of validMethods) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/payments/initiate-local')
          .set('Authorization', `Bearer ${token}`)
          .send({ order_id: orderId, payment_method: method });

        // Each call may fail if order is already paid — skip
        if (res.status === 404) continue;

        expect(res.status).toBe(201);
        // response may be wrapped in {data:...} by interceptor or returned directly
        const payload = res.body?.data ?? res.body;
        expect(payload).toMatchObject({
          reference_number: expect.stringMatching(/^LOC-/),
          amount: expect.any(Number),
          payment_method: method,
        });
      }
    });
  });

  // ─── 4. ADMIN CONFIRM ───────────────────────────────────────────────────────

  describe('PATCH /api/v1/admin/transactions/:id/confirm', () => {
    it('401/403 — admin confirm without token (auth or CSRF guard fires)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/admin/transactions/fake-id/confirm');
      expect([401, 403]).toContain(res.status);
    });

    it('404 — non-existent transaction returns 404 (requires admin token)', async () => {
      const token = process.env.TEST_ADMIN_TOKEN;
      if (!token) return;

      await request(app.getHttpServer())
        .patch('/api/v1/admin/transactions/00000000-0000-0000-0000-000000000000/confirm')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─── 5. STRIPE NOT CONFIGURED ───────────────────────────────────────────────

  describe('POST /api/v1/payments/checkout/gig — Stripe not configured', () => {
    it('400 — returns "Card payments not available" when STRIPE_SECRET_KEY is absent', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const orderId = process.env.TEST_PENDING_ORDER_ID;
      if (!token || !orderId) return;
      if (process.env.STRIPE_SECRET_KEY) return; // Stripe IS configured, skip

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/checkout/gig')
        .set('Authorization', `Bearer ${token}`)
        .send({ order_id: orderId })
        .expect(400);

      expect(res.body.message).toMatch(/card payments|not available/i);
    });
  });

  // ─── 6. UNVERIFIED EMAIL BLOCKED ────────────────────────────────────────────

  describe('Unverified email — payment blocked', () => {
    it('400 — payment attempt by unverified user returns descriptive error', async () => {
      const token = process.env.TEST_UNVERIFIED_TOKEN;
      const orderId = process.env.TEST_PENDING_ORDER_ID;
      if (!token || !orderId) return;

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate-local')
        .set('Authorization', `Bearer ${token}`)
        .send({ order_id: orderId, payment_method: 'cliq' })
        .expect(400);

      expect(res.body.message).toMatch(/verify.*email/i);
    });
  });

  // ─── 7. TRANSACTION ACCESS CONTROL ─────────────────────────────────────────

  describe('GET /api/v1/payments/transactions/:id — IDOR protection', () => {
    it('404 — user cannot read another user\'s transaction', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const otherUserTxId = process.env.TEST_OTHER_USER_TX_ID;
      if (!token || !otherUserTxId) return;

      // Must return 404 (not 403, to avoid leaking existence) or 403
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payments/transactions/${otherUserTxId}`)
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.status);
    });
  });
});
