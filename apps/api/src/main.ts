// Force-load .env BEFORE Nest ConfigModule so values in .env win over any
// empty shell-level overrides (e.g. some environments pre-set ANTHROPIC_API_KEY="").
import { config as loadDotenv } from 'dotenv';
loadDotenv({ override: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ZodResponseInterceptor } from './middleware/zod-response.interceptor';
import { LoggingInterceptor } from 'src/middleware/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required.');
  }

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Impersonation',
      'X-Requested-With',
      'X-Api-Key',
      'Accept',
    ],
    exposedHeaders: ['Authorization'],
    preflightContinue: false,
  });
  app.use(cookieParser());

  // ── Rate limiting ────────────────────────────────────────────
  // Global default: 120 req/min per IP. Tight enough to stop scrapers /
  // mistakes, loose enough that a real demo doesn't trip it.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
      // Skip CORS preflight + WS upgrade — they're not user-facing.
      skip: (req) => req.method === 'OPTIONS' || req.headers.upgrade === 'websocket',
    }),
  );

  // Stricter limits on auth + purchase paths (brute force / abuse vectors).
  app.use(
    ['/api/app-user/login', '/api/app-user/signup'],
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { code: 'RATE_LIMITED_AUTH', message: 'Too many auth attempts.' },
    }),
  );
  app.use(
    ['/api/v1/kaas/shop/agents/skills/buy', '/api/v1/kaas/shop/buy-and-install', '/api/v1/kaas/credits/deposit'],
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { code: 'RATE_LIMITED_PURCHASE', message: 'Slow down — too many purchases.' },
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new ZodResponseInterceptor(reflector));
  app.setGlobalPrefix('api');

  // Swagger 설정
  const config = new DocumentBuilder()
      .setTitle('egoidsm')
      .setDescription('API 설명')
      .setVersion('1.0')
      .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'access-token',
      )
      .addApiKey(
          { type: 'apiKey', name: 'X-Api-Key', in: 'header' },
          'agent-api-key',
      )
      .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
  logger.log('Swagger: http://localhost:4000/api/docs');
}

bootstrap();
