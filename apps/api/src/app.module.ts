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
import { TutorModule } from "./tutor/tutor.module";

/** Modul fitur lain (Admin content editor/pengumuman Fase 2 -- lihat plan
 * bagian 3) ditambahkan di milestone berikutnya. File ini mengkabelkan
 * bagian cross-cutting + health check (Milestone 4), vertical slice auth
 * (Milestone 5), vertical slice belajar inti (Milestone 7), pipeline audio
 * TTS (Milestone 8), Milestone 9 -- modul admin (kelas/undangan/murid/
 * dashboard) + skenario percakapan/kamus/flashcard, dan Milestone 11 --
 * TutorModule (AI tutor). AudioModule tidak punya controller sendiri (audio
 * konten di-generate saat seed, bukan saat request -- lihat catatan di
 * audio.service.ts); konsumen requestnya adalah TutorModule (`/tutor/speak`). */
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
    TutorModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
