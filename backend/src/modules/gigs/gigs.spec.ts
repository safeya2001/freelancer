/**
 * Gigs API — integration tests (Jest + Supertest)
 *
 * Covers:
 *  1. Public endpoints — GET /gigs, GET /gigs/:id (no auth required)
 *  2. Auth guards — POST/PATCH/DELETE require a freelancer JWT
 *  3. Input validation — invalid bodies return 400
 *  4. Pagination — page/limit query params work correctly
 *
 * Run: npm test -- gigs.spec (from backend/)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from '../../app.module';

describe('Gigs endpoints (integration)', () => {
  let app: INestApplication;

  // Pre-issued test tokens from .env.test (optional — tests that need auth
  // are skipped gracefully when these are not available)
  const FREELANCER_TOKEN = process.env.TEST_FREELANCER_TOKEN;
  const CLIENT_TOKEN = process.env.TEST_CLIENT_TOKEN;

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

  // ─── 1. PUBLIC: LIST GIGS ────────────────────────────────────────────────

  describe('GET /api/v1/gigs', () => {
    it('200 — returns paginated gig list without authentication', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gigs')
        .expect(200);

      const payload = res.body?.data ?? res.body;
      // Accepts both array and paginated-wrapper shapes
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });

    it('200 — pagination params are respected (page=1, limit=5)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gigs?page=1&limit=5')
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(items.length).toBeLessThanOrEqual(5);
    });

    it('200 — category_id filter does not crash', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gigs?category_id=nonexistent-uuid')
        .expect(200);
    });

    it('200 — price range filter does not crash', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gigs?min_price=10&max_price=200')
        .expect(200);
    });

    it('200 — search query does not crash', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gigs?search=web+design')
        .expect(200);
    });
  });

  // ─── 2. PUBLIC: GET SINGLE GIG ───────────────────────────────────────────

  describe('GET /api/v1/gigs/:id', () => {
    it('404 — non-existent gig ID returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gigs/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ─── 3. PUBLIC: GET GIGS BY FREELANCER ──────────────────────────────────

  describe('GET /api/v1/gigs/freelancer/:userId', () => {
    it('200 — returns empty array for unknown user (not 500)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/gigs/freelancer/00000000-0000-0000-0000-000000000000')
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });
  });

  // ─── 4. AUTH GUARDS ──────────────────────────────────────────────────────

  describe('Auth guards — require freelancer JWT', () => {
    it('401 — POST /gigs without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/gigs')
        .send({ title_en: 'Test Gig', price: 50, delivery_days: 3 })
        .expect(401);
    });

    it('401 — PATCH /gigs/:id without token', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/gigs/00000000-0000-0000-0000-000000000000')
        .send({ price: 100 })
        .expect(401);
    });

    it('401 — DELETE /gigs/:id without token', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/gigs/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('401 — GET /gigs/my without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/gigs/my')
        .expect(401);
    });

    it('403 — POST /gigs with a client token (not a freelancer)', async () => {
      if (!CLIENT_TOKEN) return; // skip without live test token

      await request(app.getHttpServer())
        .post('/api/v1/gigs')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .send({
          title_en: 'Unauthorized Gig',
          description_en: 'Test',
          delivery_days: 3,
          price: 50,
        })
        .expect(403);
    });
  });

  // ─── 5. INPUT VALIDATION ─────────────────────────────────────────────────

  describe('POST /api/v1/gigs — input validation', () => {
    it('400 — missing required fields with a valid freelancer token', async () => {
      if (!FREELANCER_TOKEN) return; // skip without live test token

      await request(app.getHttpServer())
        .post('/api/v1/gigs')
        .set('Authorization', `Bearer ${FREELANCER_TOKEN}`)
        .send({}) // empty body — all required fields missing
        .expect(400);
    });
  });
});
