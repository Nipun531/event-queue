import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpAdapterHost } from '@nestjs/core';

import { CatchEverythingFilter } from './config/all-exceptions.filter';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const httpAdapterHost = app.get(HttpAdapterHost);
   app.useGlobalFilters(new CatchEverythingFilter(httpAdapterHost));
    app.useGlobalPipes(new ValidationPipe({whitelist: true, forbidNonWhitelisted: true}));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
