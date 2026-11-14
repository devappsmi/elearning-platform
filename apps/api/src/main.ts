import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { buildSwaggerConfig } from "./swagger.config";
import { parseTrustProxy } from "./common/trust-proxy";
import { serveLocalMedia } from "./audio/local-media";
import { resolveStorageOptions, storageEnvFromConfig } from "./audio/storage-options";
import type { Env } from "./config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Sebelum apa pun: pembatas per-IP membaca `req.ip`, dan di belakang reverse proxy nilainya
  // hanya benar kalau jumlah proxy tepercaya diberi tahu (common/trust-proxy.ts).
  const trustProxy = parseTrustProxy(config.get("TRUST_PROXY", { infer: true }));
  if (trustProxy !== false) app.getHttpAdapter().getInstance().set("trust proxy", trustProxy);

  app.use(helmet());

  // Penyimpanan audio LOKAL (bawaan tahap uji coba): berkasnya disajikan API sendiri di /media.
  const storage = resolveStorageOptions(storageEnvFromConfig(config));
  if (storage.driver === "local") serveLocalMedia(app, storage.localDir);
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
