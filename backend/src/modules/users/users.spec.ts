/**
 * Users API — integration tests (Jest + Supertest)
 *
 * Covers:
 *  1. Auth guards — GET /users/me requires JWT
 *  2. GET /users/me — returns current user profile
 *  3. PATCH /users/profile — updates profile fields
 *  4. GET /users/:id — public profile (no auth required)
 *  5. Admin routes — non-admin users get 403
 *
 * Run: npm test -- users.spec (from backend/)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from '../../app.module';

describe('Users endpoints (integration)', () => {
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

  describe('Auth guards', () => {
    it('401 — GET /users/me without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .expect(401);
    });

    it('401 — PATCH /users/profile without token', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .send({ bio_en: 'Updated bio' })
        .expect(401);
    });
  });

  // ─── 2. GET /users/me ────────────────────────────────────────────────────

  describe('GET /api/v1/users/me', () => {
    it('200 — returns current user data with client token', async () => {
      if (!CLIENT_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .expect(200);

      const user = res.body?.data ?? res.body;
      expect(user).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
      });
      // Sensitive field must not be exposed
      expect(user.password_hash).toBeUndefined();
    });

    it('200 — returns current user data with freelancer token', async () => {
      if (!FREELANCER_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${FREELANCER_TOKEN}`)
        .expect(200);

      const user = res.body?.data ?? res.body;
      expect(user.role).toBe('freelancer');
      expect(user.password_hash).toBeUndefined();
    });
  });

  // ─── 3. PATCH /users/profile ─────────────────────────────────────────────

  describe('PATCH /api/v1/users/profile', () => {
    it('200 — updates bio field', async () => {
      if (!CLIENT_TOKEN) return;

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .send({ bio_en: 'Integration test bio update' })
        .expect(200);

      const profile = res.body?.data ?? res.body;
      expect(profile).toBeDefined();
    });

    it('400 — rejects extra/unknown fields (strict whitelist)', async () => {
      if (!CLIENT_TOKEN) return;

      await request(app.getHttpServer())
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .send({ unknown_field: 'hacker', role: 'admin' }) // forbidden fields
        .expect(400);
    });
  });

  // ─── 4. PUBLIC PROFILE ───────────────────────────────────────────────────

  describe('GET /api/v1/users/:id', () => {
    it('404 — unknown user returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ─── 5. ADMIN ROUTES ─────────────────────────────────────────────────────

  describe('Admin routes', () => {
    it('403 — non-admin cannot list all users', async () => {
      if (!CLIENT_TOKEN) return;

      await request(app.getHttpServer())
        .get('/api/v1/users/admin/all')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .expect(403);
    });

    it('200 — admin can list all users', async () => {
      if (!ADMIN_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/admin/all')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });

    it('403 — non-admin cannot change user status', async () => {
      if (!CLIENT_TOKEN) return;

      await request(app.getHttpServer())
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .send({ status: 'suspended' })
        .expect(403);
    });
  });
});
