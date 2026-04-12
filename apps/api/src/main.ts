import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ZodResponseInterceptor } from './middleware/zod-response.interceptor';
import { LoggingInterceptor } from 'src/middleware/logging.interceptor';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

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
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
  logger.log('Swagger: http://localhost:4000/api/docs');
}

bootstrap();
