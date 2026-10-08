import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { AdminClassesModule } from "../admin-classes/admin-classes.module";
import { AuthModule } from "../auth/auth.module";
import { GamificationModule } from "../gamification/gamification.module";
import { AdminStudentsController } from "./admin-students.controller";
import { AdminStudentsService } from "./admin-students.service";

@Module({
  imports: [AdminAuthModule, AdminClassesModule, AuthModule, GamificationModule],
  controllers: [AdminStudentsController],
  providers: [AdminStudentsService],
})
export class AdminStudentsModule {}
