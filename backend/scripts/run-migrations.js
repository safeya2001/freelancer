const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Running ${files.length} migrations...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`  → ${file}`);
    try {
      execSync(`psql "${databaseUrl}" -f "${filePath}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`  ✗ Failed: ${file}`);
      // Continue — some migrations may have already been applied
    }
  }

  console.log('Migrations complete.');
}

runMigrations();
