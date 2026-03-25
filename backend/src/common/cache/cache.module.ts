import { Module, Global, OnModuleInit } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule implements OnModuleInit {
  constructor(private cacheService: CacheService) {}

  async onModuleInit(): Promise<void> {
    await this.cacheService.connect();
  }
}
