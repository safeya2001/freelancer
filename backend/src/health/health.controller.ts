import { Controller, Get, Inject, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import postgres from 'postgres';
import { DB } from '../database/database.module';

@Controller('health')
export class HealthController implements OnModuleDestroy {
  private redisClient: RedisClientType | null = null;

  constructor(@Inject(DB) private sql: postgres.Sql) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redisClient = createClient({ url: redisUrl }) as RedisClientType;
      this.redisClient.connect().catch(() => {});
    }
  }

  async onModuleDestroy() {
    await this.redisClient?.disconnect().catch(() => {});
  }

  @Get()
  async check() {
    const checks: Record<string, string> = {};
    let healthy = true;

    // ── Database ─────────────────────────────────────────────────
    try {
      await this.sql`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    // ── Redis ────────────────────────────────────────────────────
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'error';
        healthy = false;
      }
    } else {
      checks.redis = 'not_configured';
    }

    return {
      status: healthy ? 'ok' : 'degraded',
      checks,
      uptime: Math.floor(process.uptime()),
      ts:     new Date().toISOString(),
    };
  }
}
