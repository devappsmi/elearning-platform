import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { Env } from "./config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.enableCors({
    origin: [config.get("CORS_ORIGIN_STUDENT", { infer: true }), config.get("CORS_ORIGIN_ADMIN", { infer: true })],
    credentials: true,
  });

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`API listening on :${port}`);
}

bootstrap();
