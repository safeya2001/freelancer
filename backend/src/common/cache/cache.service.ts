import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType | null = null;
  private connected = false;

  constructor(private config: ConfigService) {}

  async connect(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — caching disabled');
      return;
    }

    try {
      this.client = createClient({
        url: redisUrl,
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      }) as RedisClientType;

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
        this.connected = false;
      });

      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected — caching enabled');
    } catch (err) {
      this.logger.warn(`Redis connection failed: ${(err as Error).message} — caching disabled`);
      this.client = null;
      this.connected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.connected) return null;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    if (!this.client || !this.connected) return;
    try {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      this.logger.warn(`Cache set failed for key ${key}: ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.connected) return;
    try {
      await this.client.del(key);
    } catch {
      // ignore
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client || !this.connected) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch {
      // ignore
    }
  }
}
