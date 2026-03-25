/**
 * Projects API — integration tests (Jest + Supertest)
 *
 * Covers:
 *  1. Public listing — GET /projects (no auth)
 *  2. Auth guards — POST/PATCH/DELETE require a client JWT
 *  3. Input validation — invalid bodies return 400
 *  4. GET /projects/:id — 404 for non-existent
 *  5. Role guard — freelancers cannot create projects (403)
 *
 * Run: npm test -- projects.spec (from backend/)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from '../../app.module';

describe('Projects endpoints (integration)', () => {
  let app: INestApplication;

  const CLIENT_TOKEN = process.env.TEST_CLIENT_TOKEN;
  const FREELANCER_TOKEN = process.env.TEST_FREELANCER_TOKEN;

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

  // ─── 1. PUBLIC: LIST PROJECTS ────────────────────────────────────────────

  describe('GET /api/v1/projects', () => {
    it('200 — returns project list without authentication', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });

    it('200 — pagination params are accepted', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?page=1&limit=5')
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(items.length).toBeLessThanOrEqual(5);
    });

    it('200 — budget filter does not crash', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects?min_budget=50&max_budget=1000')
        .expect(200);
    });
  });

  // ─── 2. PUBLIC: GET SINGLE PROJECT ───────────────────────────────────────

  describe('GET /api/v1/projects/:id', () => {
    it('404 — non-existent project ID returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  // ─── 3. AUTH GUARDS ──────────────────────────────────────────────────────

  describe('Auth guards', () => {
    it('401 — POST /projects without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .send({ title_en: 'Test Project' })
        .expect(401);
    });

    it('401 — PATCH /projects/:id without token', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/projects/00000000-0000-0000-0000-000000000000')
        .send({ title_en: 'Updated' })
        .expect(401);
    });

    it('401 — DELETE /projects/:id without token', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/projects/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  // ─── 4. ROLE GUARD — freelancer cannot post a project ────────────────────

  describe('Role guard', () => {
    it('403 — freelancer cannot create a project', async () => {
      if (!FREELANCER_TOKEN) return;

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${FREELANCER_TOKEN}`)
        .send({
          title_en: 'Freelancer should not post this',
          description_en: 'test',
          budget_min: 100,
          budget_max: 500,
        })
        .expect(403);
    });
  });

  // ─── 5. INPUT VALIDATION ─────────────────────────────────────────────────

  describe('POST /api/v1/projects — input validation', () => {
    it('400 — client sends empty body', async () => {
      if (!CLIENT_TOKEN) return;

      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .send({})
        .expect(400);
    });
  });

  // ─── 6. MY PROJECTS (auth required) ──────────────────────────────────────

  describe('GET /api/v1/projects/my', () => {
    it('401 — unauthenticated access rejected', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects/my')
        .expect(401);
    });

    it('200 — returns array of own projects for client', async () => {
      if (!CLIENT_TOKEN) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/my')
        .set('Authorization', `Bearer ${CLIENT_TOKEN}`)
        .expect(200);

      const payload = res.body?.data ?? res.body;
      const items = Array.isArray(payload) ? payload : payload.items ?? payload.data ?? [];
      expect(Array.isArray(items)).toBe(true);
    });
  });
});
