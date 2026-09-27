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
import { ContentModule } from "./content/content.module";
import { GamificationModule } from "./gamification/gamification.module";
import { SrsModule } from "./srs/srs.module";
import { LearningPathModule } from "./learning-path/learning-path.module";
import { LessonsModule } from "./lessons/lessons.module";
import { AudioModule } from "./audio/audio.module";
import { AdminClassesModule } from "./admin-classes/admin-classes.module";
import { AdminInvitationsModule } from "./admin-invitations/admin-invitations.module";
import { AdminStudentsModule } from "./admin-students/admin-students.module";
import { AdminDashboardModule } from "./admin-dashboard/admin-dashboard.module";
import { ScenariosModule } from "./scenarios/scenarios.module";
import { DictionaryModule } from "./dictionary/dictionary.module";
import { FlashcardsModule } from "./flashcards/flashcards.module";

/** Modul fitur lain (TutorModule, Admin content editor/pengumuman Fase 2 --
 * lihat plan bagian 3) ditambahkan di milestone-milestone berikutnya. File
 * ini mengkabelkan bagian cross-cutting + health check (Milestone 4),
 * vertical slice auth (Milestone 5), vertical slice belajar inti
 * (Milestone 7), pipeline audio TTS (Milestone 8), dan Milestone 9 --
 * modul admin (kelas/undangan/murid/dashboard) + skenario percakapan/
 * kamus/flashcard. AudioModule belum ada controller/konsumen di app ini
 * sendiri (audio di-generate saat seed, bukan saat request -- lihat
 * catatan di audio.service.ts) -- tetap didaftarkan di sini, sama seperti
 * SrsModule, supaya siap dipakai modul mendatang (Milestone 11) lewat DI
 * biasa. */
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
    ContentModule,
    GamificationModule,
    SrsModule,
    LearningPathModule,
    LessonsModule,
    AudioModule,
    AdminClassesModule,
    AdminInvitationsModule,
    AdminStudentsModule,
    AdminDashboardModule,
    ScenariosModule,
    DictionaryModule,
    FlashcardsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
