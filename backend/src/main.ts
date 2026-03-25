import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const logger = new Logger('Bootstrap');

function validateEnv() {
  // DATABASE_URL is optional when individual DB_HOST/DB_USER/DB_PASSWORD/DB_NAME vars are set
  const hasDbUrl = !!process.env['DATABASE_URL'];
  const hasDbVars = !!(
    process.env['DB_HOST'] &&
    process.env['DB_USER'] &&
    process.env['DB_PASSWORD'] &&
    process.env['DB_NAME']
  );
  if (!hasDbUrl && !hasDbVars) {
    logger.error(
      'Missing database configuration: provide DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME',
    );
    process.exit(1);
  }

  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!process.env['STRIPE_SECRET_KEY']) {
    logger.warn('STRIPE_SECRET_KEY not set — card payments disabled; use local payment methods.');
  }

  // Prevent weak/default secrets in production
  if (process.env.NODE_ENV === 'production') {
    const weakPatterns = ['secret', 'changeme', 'password', '12345', 'your_jwt_secret'];
    const insecureSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter(
      (k) => weakPatterns.some((w) => (process.env[k] ?? '').toLowerCase().includes(w)),
    );
    if (insecureSecrets.length) {
      logger.error(`Insecure default values detected for: ${insecureSecrets.join(', ')}`);
      process.exit(1);
    }

    // Validate DB password strength in production (skip if DATABASE_URL is set — managed by hosting provider)
    if (!process.env['DATABASE_URL']) {
      const dbPassword = process.env['DB_PASSWORD'] ?? '';
      const weakDbPatterns = ['secret', 'password', '12345', 'freelance', 'changeme'];
      if (!dbPassword || weakDbPatterns.some((w) => dbPassword.toLowerCase().includes(w))) {
        logger.error(
          'DB_PASSWORD appears weak or uses a default value. ' +
          'Set a strong random password before deploying to production.',
        );
        process.exit(1);
      }
    }

    // Validate Redis password strength in production (skip if REDIS_URL is set or Redis is disabled)
    if (process.env['REDIS_URL'] && !process.env['REDIS_PASSWORD']) {
      // REDIS_URL includes password — OK
    } else if (!process.env['REDIS_URL']) {
      // Redis disabled — OK, CacheService handles gracefully
    } else {
      const redisPassword = process.env['REDIS_PASSWORD'] ?? '';
      const weakDbPatterns = ['secret', 'password', '12345', 'freelance', 'changeme'];
      if (weakDbPatterns.some((w) => redisPassword.toLowerCase().includes(w))) {
        logger.error(
          'REDIS_PASSWORD appears weak or uses a default value. ' +
          'Set a strong random password before deploying to production.',
        );
        process.exit(1);
      }
    }
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    // Required for Stripe webhook signature verification
    rawBody: true,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // Security headers
  app.use(helmet.default({
    contentSecurityPolicy: isProduction,
    crossOriginEmbedderPolicy: isProduction,
  }));
  app.use(compression());
  // cookie-parser with a signed-cookie secret for additional integrity
  app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));

  // Secure cookie defaults — applied to cookies set via res.cookie()
  // Individual cookie calls must specify httpOnly/secure/sameSite explicitly

  // CORS — expose X-CSRF-Token so browsers can read it from responses
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    // Netlify preview & production domains
    ...(process.env.NETLIFY_URL ? [process.env.NETLIFY_URL] : []),
  ].filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // WebSockets
  app.useWebSocketAdapter(new IoAdapter(app));

  // Serve uploaded files
  app.useStaticAssets('uploads', { prefix: '/uploads' });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
}

bootstrap();
