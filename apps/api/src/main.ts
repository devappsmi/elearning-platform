import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { buildSwaggerConfig } from "./swagger.config";
import type { Env } from "./config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.enableCors({
    origin: [config.get("CORS_ORIGIN_STUDENT", { infer: true }), config.get("CORS_ORIGIN_ADMIN", { infer: true })],
    credentials: true,
  });

  // /api-docs (UI) + /api-docs-json (spec mentah, sumber packages/api-client's
  // codegen -- lihat generate-openapi.ts untuk dump statisnya, dipakai
  // sesi tanpa server hidup). Belum digerbangi khusus produksi -- API ini
  // belum live-deployed di mana pun sejauh ini (lihat docs/PLAN.md), jadi
  // belum ada kebutuhan nyata untuk itu; catat sebagai hal yang perlu
  // dipikir ulang sebelum deployment produksi sungguhan.
  SwaggerModule.setup("api-docs", app, SwaggerModule.createDocument(app, buildSwaggerConfig()));

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  console.log(`API listening on :${port}`);
}

bootstrap();
