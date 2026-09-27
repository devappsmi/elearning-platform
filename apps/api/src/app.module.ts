import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { UsersModule } from "./users/users.module";

/** Modul fitur lain (Lessons, Gamification, TutorModule, dst. -- lihat plan
 * bagian 3) ditambahkan di milestone-milestone berikutnya. File ini
 * mengkabelkan bagian cross-cutting + health check (Milestone 4) dan
 * vertical slice auth (Milestone 5). */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    AdminAuthModule,
    UsersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
