import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { buildSwaggerConfig } from "./swagger.config";

/** Dump statis spesifikasi OpenAPI ke apps/api/openapi.json -- sumber
 * codegen packages/api-client (openapi-typescript). SENGAJA lewat file
 * `src/` ini (dikompilasi `nest build` biasa), BUKAN skrip ts-node lepas --
 * plugin CLI `@nestjs/swagger` (nest-cli.json) yang menyimpulkan tipe
 * respons dari signature method controller HANYA aktif lewat `nest build`,
 * tidak lewat ts-node langsung. Jalankan lewat `pnpm run generate-openapi`
 * (build dulu, baru node dist/generate-openapi.js) supaya hasilnya PERSIS
 * sama seperti dokumen yang di-serve main.ts saat runtime.
 *
 * Butuh Postgres+Redis HIDUP (NestFactory.create menunggu semua
 * onModuleInit, termasuk PrismaService.$connect()) -- bukan bug, technical
 * constraint yang sama kenapa openapi.json (dan schema.ts hasil generate
 * packages/api-client) di-COMMIT ke repo, bukan di-generate ulang tiap
 * CI/build (CI tidak punya Redis service container -- lihat docs/PLAN.md). */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  const outPath = join(__dirname, "..", "openapi.json");
  writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");
  console.log(`OpenAPI spec ditulis ke ${outPath}`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
