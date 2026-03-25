/**
 * Wallets API — integration tests (Jest + Supertest)
 *
 * Covers:
 *  1. Auth guards — all wallet endpoints require a JWT
 *  2. GET /wallets/me — returns wallet shape with required fields
 *  3. GET /wallets/transactions — returns transaction list
 *  4. GET /wallets/escrows — returns escrow list
 *  5. Admin-only route — regular users get 403
 *
 * Run: npm test -- wallets.spec (from backend/)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from '../../app.module';

describe('Wallets endpoints (integration)', () => {
  let app: INestApplication;

  const CLIENT_TOKEN = process.env.TEST_CLIENT_TOKEN;
  const FREELANCER_TOKEN = process.env.TEST_FREELANCER_TOKEN;
  const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser(process.env.JWT_SECRET));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── 1. AUTH GUARDS ──────────────────────────────────────────────────────

  describe('Auth guards — all wallet routes require JWT', () => {
    const protectedRoutes = [
      { method: 'get', path: '/api/v1/wallets/me' },
      { method: 'get', path: '/api/v1/wallets/transactions' },
      { method: 'get', path: '/api/v1/wallets/escrows' },
    ];

    protectedRoutes.forEach(({ method, path }) => {
      it(`401 — ${method.toUpperCase()} ${path} without token`, async () => {
        await (request(app.getHttpServer()) as any)[method](path).expect(401);
      });
    });
  });

  // ─── 2. GET MY WALLET ────────────────────────────────────────────────────

  describe('GET /api/v1/wallets/me', () => {
    it('200 — returns wallet with expected fields (freelancer token)', async () => {
      if (!FREELANCER_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/wallets/me')
        .set('Authorization', `Bearer ${FREELANCER_TOKEN}`)
        .expect(200);

      const wallet = res.body?.data ?? res.body;
      expect(wallet).toMatchObject({
        balance: expect.any(String), // postgres returns numeric as string
        pending_balance: expect.any(String),
        available_balance: expect.any(String),
      });
    });

    it('200 — returns wallet with expected fields (client token)', async () => {
      if (!CLIENT_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/wallets/me')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .expect(200);

      const wallet = res.body?.data ?? res.body;
      // Wallet exists (may be empty but should not be 404)
      expect(wallet).toBeDefined();
    });
  });

  // ─── 3. GET MY TRANSACTIONS ──────────────────────────────────────────────

  describe('GET /api/v1/wallets/transactions', () => {
    it('200 — returns array (may be empty)', async () => {
      if (!FREELANCER_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/wallets/transactions')
        .set('Authorization', `Bearer ${FREELANCER_TOKEN}`)
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });
  });

  // ─── 4. GET MY ESCROWS ───────────────────────────────────────────────────

  describe('GET /api/v1/wallets/escrows', () => {
    it('200 — returns array (may be empty)', async () => {
      if (!FREELANCER_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/wallets/escrows')
        .set('Authorization', `Bearer ${FREELANCER_TOKEN}`)
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });
  });

  // ─── 5. ADMIN ROUTE — unauthorized access ───────────────────────────────

  describe('GET /api/v1/wallets/admin/all', () => {
    it('403 — non-admin user is rejected', async () => {
      if (!CLIENT_TOKEN) return;

      await request(app.getHttpServer())
        .get('/api/v1/wallets/admin/all')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .expect(403);
    });

    it('200 — admin token can access all wallets', async () => {
      if (!ADMIN_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/wallets/admin/all')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });
  });
});
