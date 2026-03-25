/**
 * Test Data Seed Script — Dopa Work Platform
 *
 * Creates ALL data needed for automated tests and writes .env.test
 *
 * Run inside backend container:
 *   docker exec freelance_backend node /app/scripts/seed-test-data.js
 */

'use strict';

const postgres   = require('postgres');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const fs         = require('fs');
const path       = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL || (
  `postgres://${process.env.DB_USER || 'freelance'}:${process.env.DB_PASSWORD || 'freelance_secret'}` +
  `@${process.env.DB_HOST || 'postgres'}:5432/${process.env.DB_NAME || 'freelance_db'}`
);

const JWT_SECRET         = process.env.JWT_SECRET         || '7096b8bbe191eb1d7eea153ae3a738f2f3ab8e164cd9f73cc47d33ec108e64e6d56845920e3274f4dcad437686f0f248';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '7f39444285a6f8cbbcb42ee5ef17953f6bddaff39a72be150cd87687e56e0225d876f0a16dd3df437f3bfb226b8a8ce1';
const CATEGORY_ID        = '061cae40-2a09-4647-8c0e-589e9f9b18ac';

const PASSWORD      = 'Test1234!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

const sql = postgres(DB_URL, { max: 5 });

// ─── JWT HELPER ──────────────────────────────────────────────────────────────

function signToken(userId, role) {
  return jwt.sign(
    { sub: userId, role, email: `${role}@test.com` },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

// ─── SEED ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  Seeding test data…\n');

  // ── 1. USERS ────────────────────────────────────────────────────────────────

  // Upsert all users (no DELETE — avoids FK constraint issues on re-runs)
  const upsertUser = async (email, role, verified) => {
    const [u] = await sql`
      INSERT INTO users (email, password_hash, role, status, email_verified)
      VALUES (${email}, ${PASSWORD_HASH}, ${role}, ${verified ? 'active' : 'pending'}, ${verified})
      ON CONFLICT (email) DO UPDATE SET
        password_hash  = ${PASSWORD_HASH},
        status         = ${verified ? 'active' : 'pending'},
        email_verified = ${verified}
      RETURNING id, email, role
    `;
    return u;
  };

  const client         = await upsertUser('client@seed.test',           'client',     true);
  const freelancer     = await upsertUser('freelancer@seed.test',       'freelancer', true);
  const admin          = await upsertUser('admin@seed.test',            'admin',      true);
  const unverified     = await upsertUser('unverified@seed.test',       'client',     false);
  const other          = await upsertUser('other@seed.test',            'client',     true);
  const otherFreelancer = await upsertUser('other.freelancer@seed.test','freelancer', true);

  console.log('✅  Users created');

  // ── 2. PROFILES ─────────────────────────────────────────────────────────────

  const upsertProfile = async (userId, name, role) => {
    await sql`
      INSERT INTO profiles (user_id, full_name_en, full_name_ar, bio_en, hourly_rate)
      VALUES (${userId}, ${name}, ${name + ' AR'}, ${'Test profile for ' + role}, 25.000)
      ON CONFLICT (user_id) DO UPDATE SET full_name_en = ${name}
    `;
  };

  await upsertProfile(client.id,         'Test Client',          'client');
  await upsertProfile(freelancer.id,      'Test Freelancer',      'freelancer');
  await upsertProfile(admin.id,           'Test Admin',           'admin');
  await upsertProfile(unverified.id,      'Unverified User',      'client');
  await upsertProfile(other.id,           'Other Client',         'client');
  await upsertProfile(otherFreelancer.id, 'Other Freelancer',     'freelancer');

  console.log('✅  Profiles created');

  // ── 3. GIG + PACKAGE ────────────────────────────────────────────────────────

  const gigSlug = `test-gig-seed-${Date.now()}`;
  const [gig] = await sql`
    INSERT INTO gigs (freelancer_id, category_id, title_en, title_ar, description_en, slug, price, delivery_days, status)
    VALUES (
      ${freelancer.id}, ${CATEGORY_ID},
      'Test Gig for Automated Testing',
      'خدمة اختبار تلقائي',
      'This gig is seeded for automated test runs.',
      ${gigSlug}, 50.000, 3, 'active'
    )
    RETURNING id
  `;

  const [pkg] = await sql`
    INSERT INTO gig_packages (gig_id, package_type, name_en, name_ar, description_en, price, delivery_days, revisions)
    VALUES (${gig.id}, 'basic', 'Basic', 'أساسي', 'Basic package for testing', 50.000, 3, 2)
    ON CONFLICT (gig_id, package_type) DO UPDATE SET name_en = 'Basic'
    RETURNING id
  `;

  console.log('✅  Gig + package created');

  // ── 4. ORDERS ───────────────────────────────────────────────────────────────

  // Pending order (not yet paid) — used for payment tests
  const [pendingOrder] = await sql`
    INSERT INTO orders (gig_id, package_id, client_id, freelancer_id, price, delivery_days, status)
    VALUES (${gig.id}, ${pkg.id}, ${client.id}, ${freelancer.id}, 50.000, 3, 'pending')
    RETURNING id
  `;

  // Delivered order (freelancer delivered, awaiting client accept) — double-click test
  const [deliveredOrder] = await sql`
    INSERT INTO orders (gig_id, package_id, client_id, freelancer_id, price, delivery_days,
                        status, delivered_at, delivery_note)
    VALUES (${gig.id}, ${pkg.id}, ${client.id}, ${freelancer.id}, 75.000, 3,
            'delivered', NOW(), 'Work is complete. Please review.')
    RETURNING id
  `;

  // Order belonging to "other" user — IDOR test
  const [otherOrder] = await sql`
    INSERT INTO orders (gig_id, package_id, client_id, freelancer_id, price, delivery_days, status)
    VALUES (${gig.id}, ${pkg.id}, ${other.id}, ${freelancer.id}, 30.000, 3, 'pending')
    RETURNING id
  `;

  console.log('✅  Orders created');

  // ── 5. CONTRACTS ────────────────────────────────────────────────────────────

  const [activeContract] = await sql`
    INSERT INTO contracts (client_id, freelancer_id, title_en, total_amount, status, start_date, end_date)
    VALUES (${client.id}, ${freelancer.id}, 'Test Active Contract', 300.000, 'active',
            CURRENT_DATE, CURRENT_DATE + 30)
    RETURNING id
  `;

  const [completedContract] = await sql`
    INSERT INTO contracts (client_id, freelancer_id, title_en, total_amount, status, start_date, end_date)
    VALUES (${client.id}, ${freelancer.id}, 'Test Completed Contract', 200.000, 'completed',
            CURRENT_DATE - 60, CURRENT_DATE - 10)
    RETURNING id
  `;

  // Contract between "other" users — IDOR test
  const [otherContract] = await sql`
    INSERT INTO contracts (client_id, freelancer_id, title_en, total_amount, status)
    VALUES (${other.id}, ${otherFreelancer.id}, 'Other Users Contract', 100.000, 'active')
    RETURNING id
  `;

  console.log('✅  Contracts created');

  // ── 6. MILESTONES ───────────────────────────────────────────────────────────

  const [pendingMilestone] = await sql`
    INSERT INTO milestones (contract_id, title_en, title_ar, amount, status, sort_order)
    VALUES (${activeContract.id}, 'Design Phase', 'مرحلة التصميم', 100.000, 'pending', 0)
    RETURNING id
  `;

  console.log('✅  Milestone created');

  // ── 7. CHAT ROOMS ────────────────────────────────────────────────────────────

  const [chatRoom] = await sql`
    INSERT INTO chat_rooms (client_id, freelancer_id, contract_id)
    VALUES (${client.id}, ${freelancer.id}, ${activeContract.id})
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  // Fallback: if there was a conflict, fetch the existing room
  const chatRoomId = chatRoom?.id ?? (await sql`
    SELECT id FROM chat_rooms WHERE contract_id = ${activeContract.id} LIMIT 1
  `)[0]?.id;

  // Chat room for "other" users — IDOR test
  const [otherChatRoom] = await sql`
    INSERT INTO chat_rooms (client_id, freelancer_id, contract_id)
    VALUES (${other.id}, ${otherFreelancer.id}, ${otherContract.id})
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  const otherChatRoomId = otherChatRoom?.id ?? (await sql`
    SELECT id FROM chat_rooms WHERE contract_id = ${otherContract.id} LIMIT 1
  `)[0]?.id;

  console.log('✅  Chat rooms created');

  // ── 8. TRANSACTIONS ──────────────────────────────────────────────────────────

  // Pending local payment transaction — for admin confirm tests
  const refNum = `LOC-TEST-${Date.now().toString(36).toUpperCase()}`;
  const [pendingTx] = await sql`
    INSERT INTO transactions
      (order_id, from_user_id, type, amount, status, payment_method,
       description_en, description_ar, reference_number, payment_instructions)
    VALUES
      (${pendingOrder.id}, ${client.id}, 'deposit', 50.000, 'pending', 'cliq',
       'Test pending CliQ payment', 'دفعة CliQ اختبارية',
       ${refNum},
       ${ JSON.stringify({ instructions_en: 'Send 50 JOD via CliQ', instructions_ar: 'أرسل 50 د.أ عبر CliQ', details: { cliq_alias: 'TEST.DOPAWORK' } }) })
    RETURNING id
  `;

  // Transaction belonging to "other" user — IDOR test
  const [otherTx] = await sql`
    INSERT INTO transactions
      (order_id, from_user_id, type, amount, status, payment_method, description_en)
    VALUES
      (${otherOrder.id}, ${other.id}, 'deposit', 30.000, 'pending', 'bank_transfer', 'Other user tx')
    RETURNING id
  `;

  console.log('✅  Transactions created');

  // ── 9. DISPUTE ───────────────────────────────────────────────────────────────

  const [dispute] = await sql`
    INSERT INTO disputes
      (opened_by, client_id, freelancer_id, contract_id,
       title_en, description_en, status)
    VALUES
      (${client.id}, ${client.id}, ${freelancer.id}, ${activeContract.id},
       'Test Dispute — Delivery Not Accepted',
       'The client opened this dispute for automated testing purposes.',
       'open')
    RETURNING id
  `;

  console.log('✅  Dispute created');

  // ── 10. GENERATE JWT TOKENS ──────────────────────────────────────────────────

  const clientToken      = signToken(client.id,     client.role);
  const freelancerToken  = signToken(freelancer.id,  freelancer.role);
  const adminToken       = signToken(admin.id,       admin.role);
  const unverifiedToken  = signToken(unverified.id,  unverified.role);

  console.log('✅  JWT tokens generated');

  // ── 11. WRITE .env.test ──────────────────────────────────────────────────────

  const envContent = `# AUTO-GENERATED by seed-test-data.js — DO NOT EDIT MANUALLY
# Re-run: docker exec freelance_backend node /app/scripts/seed-test-data.js

# ── Backend ──────────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USER=freelance
DB_PASSWORD=freelance_secret
DB_NAME=freelance_db
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
REDIS_PASSWORD=redis_secret

# ── Playwright ──────────────────────────────────────────────────────────────
PLAYWRIGHT_BASE_URL=http://localhost:3002

# ── Test user credentials ────────────────────────────────────────────────────
TEST_CLIENT_EMAIL=client@seed.test
TEST_CLIENT_PASSWORD=${PASSWORD}
TEST_FREELANCER_EMAIL=freelancer@seed.test
TEST_FREELANCER_PASSWORD=${PASSWORD}
TEST_ADMIN_EMAIL=admin@seed.test
TEST_ADMIN_PASSWORD=${PASSWORD}

# ── Test tokens (30-day JWT, valid immediately) ──────────────────────────────
TEST_USER_TOKEN=${clientToken}
TEST_CLIENT_TOKEN=${clientToken}
TEST_FREELANCER_TOKEN=${freelancerToken}
TEST_ADMIN_TOKEN=${adminToken}
TEST_UNVERIFIED_TOKEN=${unverifiedToken}

# ── Seeded entity IDs ────────────────────────────────────────────────────────
TEST_PENDING_ORDER_ID=${pendingOrder.id}
TEST_DELIVERED_ORDER_ID=${deliveredOrder.id}
TEST_OTHER_ORDER_ID=${otherOrder.id}
TEST_PENDING_TX_ID=${pendingTx.id}
TEST_OTHER_USER_TX_ID=${otherTx.id}
TEST_FREELANCER_CONTRACT_ID=${activeContract.id}
TEST_COMPLETED_CONTRACT_ID=${completedContract.id}
TEST_OTHER_CONTRACT_ID=${otherContract.id}
TEST_PENDING_MILESTONE_ID=${pendingMilestone.id}
TEST_DISPUTE_ID=${dispute.id}
TEST_CHAT_ROOM_ID=${chatRoomId}
TEST_OTHER_CHAT_ROOM_ID=${otherChatRoomId}
TEST_OTHER_PROJECT_ID=
TEST_FREELANCER_PROFILE_URL=/freelancers
`;

  // Write to project root as .env.test
  const envPath = '/tmp/.env.test';
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`\n✅  .env.test written → ${envPath}`);

  // Also print summary for reference
  console.log('\n─────────────────────────────────────────');
  console.log('  SEEDED IDs SUMMARY');
  console.log('─────────────────────────────────────────');
  console.log(`  client.id         = ${client.id}`);
  console.log(`  freelancer.id     = ${freelancer.id}`);
  console.log(`  admin.id          = ${admin.id}`);
  console.log(`  unverified.id     = ${unverified.id}`);
  console.log(`  other.id          = ${other.id}`);
  console.log(`  pendingOrder.id   = ${pendingOrder.id}`);
  console.log(`  deliveredOrder.id = ${deliveredOrder.id}`);
  console.log(`  activeContract.id = ${activeContract.id}`);
  console.log(`  dispute.id        = ${dispute.id}`);
  console.log(`  pendingTx.id      = ${pendingTx.id}`);
  console.log(`  chatRoomId        = ${chatRoomId}`);
  console.log('─────────────────────────────────────────\n');

  await sql.end();
  console.log('🎉  Seed complete!\n');
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  console.error(err);
  process.exit(1);
});
