#!/usr/bin/env node
/**
 * Seed Admin Script
 *
 * Creates the initial super_admin user from environment variables.
 * Run ONCE after the first deployment:
 *
 *   ADMIN_EMAIL=admin@yourdomain.com \
 *   ADMIN_PASSWORD=YourStrongPass123! \
 *   npm run seed:admin
 *
 * Required environment variables:
 *   ADMIN_EMAIL       — admin email address
 *   ADMIN_PASSWORD    — admin password (min 8 chars, uppercase, digit, special char)
 *   DATABASE_URL      — PostgreSQL connection string  OR
 *   DB_HOST + DB_PORT + DB_USER + DB_PASSWORD + DB_NAME
 *
 * The script is idempotent: if a super_admin already exists it exits cleanly.
 */

'use strict';

const bcrypt = require('bcrypt');
const postgres = require('postgres');

async function seedAdmin() {
  // ── Validate required env vars ──────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      'ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.\n' +
      'Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Secure123! npm run seed:admin',
    );
    process.exit(1);
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    console.error('ERROR: ADMIN_EMAIL must be a valid email address.');
    process.exit(1);
  }

  // Password complexity: min 8 chars, at least one uppercase, one digit, one special char
  const pwOk =
    adminPassword.length >= 8 &&
    /[A-Z]/.test(adminPassword) &&
    /[0-9]/.test(adminPassword) &&
    /[^A-Za-z0-9]/.test(adminPassword);

  if (!pwOk) {
    console.error(
      'ERROR: ADMIN_PASSWORD must be at least 8 characters and include\n' +
      'uppercase letters, numbers, and special characters (e.g. !, @, #).',
    );
    process.exit(1);
  }

  // ── Connect to database ──────────────────────────────────────────────────
  let sql;
  if (process.env.DATABASE_URL) {
    sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DB_SSL === 'true' ? 'require' : false });
  } else {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL } = process.env;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      console.error(
        'ERROR: Provide DATABASE_URL or all of DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.',
      );
      process.exit(1);
    }
    sql = postgres({
      host: DB_HOST,
      port: parseInt(DB_PORT || '5432', 10),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      ssl: DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }

  try {
    // ── Idempotency check ────────────────────────────────────────────────
    const existing = await sql`
      SELECT id, email FROM users WHERE role = 'super_admin' LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`INFO: Super admin already exists (${existing[0].email}). Nothing to do.`);
      console.log('To reset the password use the application password-reset feature.');
      return;
    }

    // ── Hash password ────────────────────────────────────────────────────
    console.log('Hashing password (this may take a moment)...');
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // ── Insert user and profile ──────────────────────────────────────────
    const [user] = await sql`
      INSERT INTO users (email, password_hash, role, status, email_verified, preferred_language)
      VALUES (${adminEmail}, ${passwordHash}, 'super_admin', 'active', TRUE, 'ar')
      RETURNING id, email, role
    `;

    await sql`
      INSERT INTO profiles (user_id, full_name_en, full_name_ar)
      VALUES (${user.id}, 'Super Admin', 'المدير الأعلى')
    `;

    console.log('');
    console.log('Super admin created successfully:');
    console.log(`  Email : ${user.email}`);
    console.log(`  Role  : ${user.role}`);
    console.log(`  ID    : ${user.id}`);
    console.log('');
    console.log('IMPORTANT: Store the credentials securely and do not share them.');
  } finally {
    await sql.end();
  }
}

seedAdmin().catch((err) => {
  console.error('ERROR: Seed failed:', err.message);
  process.exit(1);
});
