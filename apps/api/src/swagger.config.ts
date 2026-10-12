import { DocumentBuilder } from "@nestjs/swagger";

/** Dipakai bareng oleh main.ts (Swagger UI + /api-docs-json saat dev) DAN
 * generate-openapi.ts (dump statis ke openapi.json, dipakai codegen
 * packages/api-client) -- satu sumber kebenaran skema dokumen supaya dua
 * jalur itu tidak diam-diam divergen. Dua skema bearer TERPISAH
 * ("access-token" vs "admin-access-token"), BUKAN satu digabung -- token
 * murid dan admin memang secret/audience yang beda total (lihat plan
 * bagian "Keputusan Lintas-Sektor"), jadi dokumennya jujur menggambarkan
 * itu, termasuk supaya tombol "Authorize" Swagger UI punya 2 field
 * terpisah, bukan menyiratkan satu token bisa dipakai untuk keduanya. */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle("Elearning Platform API")
    .setDescription(
      "Backend NestJS platform kursus bahasa Jepang (single-tenant). Lihat docs/PRD.md dan docs/PLAN.md di repo untuk konteks produk lengkap.",
    )
    .setVersion("0.0.1")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "admin-access-token")
    .build();
}
