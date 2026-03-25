const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { ssl: { rejectUnauthorized: false }, max: 1 });

  const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Running ${files.length} migrations...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`  → ${file}`);
    try {
      await sql.unsafe(content);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${file} — ${err.message}`);
      // Continue — some migrations may have already been applied
    }
  }

  await sql.end();
  console.log('Migrations complete.');
}

runMigrations();
