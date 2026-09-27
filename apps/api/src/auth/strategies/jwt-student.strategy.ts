import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Env } from "../../config/env.validation";

interface StudentJwtPayload {
  sub: string;
  type: "access" | "refresh";
}

@Injectable()
export class JwtStudentStrategy extends PassportStrategy(Strategy, "jwt-student") {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_STUDENT_SECRET", { infer: true }),
    });
  }

  // Passport attaches the return value as req.user. Reject refresh tokens
  // presented as access tokens -- they share a secret but not a purpose.
  validate(payload: StudentJwtPayload): { userId: string } {
    if (payload.type !== "access") {
      throw new Error("Token bukan access token");
    }
    return { userId: payload.sub };
  }
}
