import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        if (databaseUrl) {
          return postgres(databaseUrl, {
            max: 20,
            idle_timeout: 30,
            connect_timeout: 10,
            onnotice: () => {},
          });
        }
        return postgres({
          host: config.get('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          database: config.get('DB_NAME', 'freelance_db'),
          username: config.get('DB_USER', 'postgres'),
          password: config.get('DB_PASSWORD', 'postgres'),
          max: 20,
          idle_timeout: 30,
          connect_timeout: 10,
          onnotice: () => {},
        });
      },
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
