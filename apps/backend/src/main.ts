import { config } from 'dotenv';
import { join } from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

const dotenvResult = config({ path: join(__dirname, '..', '.env') });
if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT') {
  throw dotenvResult.error;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  const frontendUrl = process.env.FRONTEND_URL;
  const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsOrigin = isProduction
    ? [...(frontendUrl ? [frontendUrl] : []), ...configuredOrigins]
    : configuredOrigins.length
      ? configuredOrigins
      : ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && isProduction) {
    new Logger('Bootstrap').warn(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
void bootstrap();
