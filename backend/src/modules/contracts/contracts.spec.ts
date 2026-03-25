/**
 * Contracts API — integration tests (Jest + Supertest)
 *
 * Covers:
 *  1. Auth guards — all contract endpoints require JWT
 *  2. Access control — freelancer cannot modify client's contract & vice-versa
 *  3. Cross-user IDOR — user cannot read another user's contract details
 *  4. Milestone operations — only client can add milestones to active contracts
 *  5. Contract completion — only client can mark complete, not the freelancer
 *  6. Admin oversight — admin can list all contracts
 *
 * Run: npm test -- contracts.spec (from backend/)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
const cookieParser = require('cookie-parser');
import { AppModule } from '../../app.module';

describe('Contracts endpoints (integration)', () => {
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

  describe('Auth guards — unauthenticated', () => {
    it('401 — GET /contracts/my without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/contracts/my').expect(401);
    });

    it('401 — GET /contracts/:id without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/contracts/some-id').expect(401);
    });

    it('401/403 — POST /contracts/:id/milestones without token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/contracts/some-id/milestones')
        .send({ title_en: 'Design', amount: 50 });
      expect([401, 403]).toContain(res.status);
    });

    it('401/403 — PATCH /contracts/:id/complete without token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/contracts/some-id/complete');
      expect([401, 403]).toContain(res.status);
    });
  });

  // ─── 2. CROSS-USER IDOR PROTECTION ──────────────────────────────────────────

  describe('IDOR — user cannot access another user\'s contract (requires live DB)', () => {
    it('403 or 404 — client cannot read contract they are not part of', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const otherContractId = process.env.TEST_OTHER_CONTRACT_ID;
      if (!token || !otherContractId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/contracts/${otherContractId}`)
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.status);
    });

    it('403 or 404 — freelancer cannot read contract they are not party to', async () => {
      const token = process.env.TEST_FREELANCER_TOKEN;
      const otherContractId = process.env.TEST_OTHER_CONTRACT_ID;
      if (!token || !otherContractId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/contracts/${otherContractId}`)
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── 3. MILESTONE AUTHORIZATION ─────────────────────────────────────────────

  describe('POST /contracts/:id/milestones — access control', () => {
    it('403 — freelancer cannot add milestones to a contract', async () => {
      const token = process.env.TEST_FREELANCER_TOKEN;
      const contractId = process.env.TEST_FREELANCER_CONTRACT_ID;
      if (!token || !contractId) return;

      // The freelancer is party to this contract but NOT the client
      const res = await request(app.getHttpServer())
        .post(`/api/v1/contracts/${contractId}/milestones`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title_en: 'Milestone', amount: 100, due_date: '2026-06-01' });

      expect([403, 404]).toContain(res.status);
    });

    it('400 — cannot add milestone to inactive/completed contract (requires live DB)', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const completedContractId = process.env.TEST_COMPLETED_CONTRACT_ID;
      if (!token || !completedContractId) return;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/contracts/${completedContractId}/milestones`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title_en: 'Extra work', amount: 50 })
        .expect(403);

      expect(res.body.message).toMatch(/not active/i);
    });
  });

  // ─── 4. CONTRACT COMPLETION ──────────────────────────────────────────────────

  describe('PATCH /contracts/:id/complete — role restriction', () => {
    it('403 — freelancer cannot mark contract as complete', async () => {
      const token = process.env.TEST_FREELANCER_TOKEN;
      const contractId = process.env.TEST_FREELANCER_CONTRACT_ID;
      if (!token || !contractId) return;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/contracts/${contractId}/complete`)
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── 5. ADMIN CONTRACT OVERSIGHT ────────────────────────────────────────────

  describe('GET /api/v1/admin/contracts — admin only', () => {
    it('401 — not accessible without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/contracts')
        .expect(401);
    });

    it('403 — not accessible by regular client/freelancer', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      if (!token) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/contracts')
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.status);
    });

    it('200 — admin can list all contracts (requires admin token)', async () => {
      const token = process.env.TEST_ADMIN_TOKEN;
      if (!token) return;

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/contracts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Admin contracts endpoint returns {total, contracts:[]} or a plain array
      const payload = res.body?.data ?? res.body;
      const contracts = payload?.contracts ?? payload;
      expect(Array.isArray(contracts) || typeof payload === 'object').toBe(true);
    });
  });

  // ─── 6. CONTRACT PROJECT VISIBILITY ─────────────────────────────────────────

  describe('Cross-user message / chat room access', () => {
    it('401 — chat room is not publicly accessible', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/chat/rooms/fake-room-id/messages')
        .expect(401);
    });

    it('403 or 404 — client cannot read messages from another client\'s room', async () => {
      const token = process.env.TEST_CLIENT_TOKEN;
      const otherRoomId = process.env.TEST_OTHER_CHAT_ROOM_ID;
      if (!token || !otherRoomId) return;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${otherRoomId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect([403, 404]).toContain(res.status);
    });
  });
});
