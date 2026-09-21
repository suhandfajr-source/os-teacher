import { spawn, execSync } from 'node:child_process';
import net from 'node:net';
import pg from 'pg';
const { Client } = pg;

const DEFAULT_PORT = 51214;
const SHADOW_URL = `postgres://postgres:postgres@localhost:${DEFAULT_PORT}/shadow_db?sslmode=disable`;
const TEMPLATE_URL = `postgres://postgres:postgres@localhost:${DEFAULT_PORT}/template1?sslmode=disable`;

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, 'localhost', () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
  });
}

async function ensurePrismaDevEngine() {
  const isUp = await checkPort(DEFAULT_PORT);
  if (isUp) {
    return;
  }

  console.log('[verify-migrations] Prisma dev engine is not running. Starting default server in background...');
  try {
    // Start background process
    const child = spawn('npx', ['prisma', 'dev', 'start', 'default'], {
      stdio: 'ignore',
      detached: true,
      shell: true,
    });
    child.unref();

    // Poll until port is open (up to 10 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkPort(DEFAULT_PORT)) {
        console.log('[verify-migrations] Prisma dev engine is now online.');
        return;
      }
    }
    throw new Error('Timed out waiting for Prisma dev engine on port ' + DEFAULT_PORT);
  } catch (err) {
    console.error('[verify-migrations] Failed to start prisma dev engine:', err.message);
    process.exit(1);
  }
}

async function recreateShadowDatabase() {
  const client = new Client({ connectionString: TEMPLATE_URL });
  try {
    await client.connect();
    await client.query('DROP DATABASE IF EXISTS shadow_db;');
    await client.query('CREATE DATABASE shadow_db;');
  } catch (err) {
    console.error('[verify-migrations] Failed to recreate shadow_db:', err.message);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  try {
    await ensurePrismaDevEngine();
    await recreateShadowDatabase();
  } catch (err) {
    console.error('[verify-migrations] Tooling setup error:', err.message);
    process.exit(1);
  }

  const env = {
    ...process.env,
    SHADOW_DATABASE_URL: SHADOW_URL,
  };

  return new Promise((resolve) => {
    const args = [
      'prisma',
      'migrate',
      'diff',
      '--from-migrations',
      'prisma/migrations',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ];

    const child = spawn('npx', args, { env, shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ [verify-migrations] Migration chain matches schema.prisma perfectly. No drift detected.');
        process.exit(0);
      } else if (code === 2) {
        console.warn('⚠️  [verify-migrations] Schema drift detected between migrations/ and schema.prisma:');
        console.warn(stdout || stderr);
        console.warn('\nTo reconcile, create a migration reflecting the delta or run reconciliation procedures.');
        process.exit(2);
      } else {
        console.error('❌ [verify-migrations] Replay / tooling error encountered (exit code ' + code + '):');
        console.error(stderr || stdout);
        process.exit(1);
      }
    });
  });
}

main().catch((err) => {
  console.error('[verify-migrations] Unexpected error:', err);
  process.exit(1);
});
