import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStudentStrategy } from "./strategies/jwt-student.strategy";
import { MailModule } from "../mail/mail.module";

// Sengaja NOT global dan tanpa secret default -- AuthService selalu passing
// secret/expiresIn eksplisit per panggilan (JWT_STUDENT_SECRET), supaya
// tidak ada ambiguitas dengan JwtModule punya AdminAuthModule yang pakai
// secret admin yang beda (lihat plan: batas kepercayaan student vs admin
// harus benar-benar terpisah, bukan cuma beda route).
@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStudentStrategy],
  exports: [AuthService],
})
export class AuthModule {}
