import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Env } from "../../config/env.validation";
import type { AdminRole } from "@prisma/client";

interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
  type: "access" | "refresh";
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, "jwt-admin") {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_ADMIN_SECRET", { infer: true }),
    });
  }

  validate(payload: AdminJwtPayload): { adminUserId: string; role: AdminRole } {
    if (payload.type !== "access") {
      throw new Error("Token bukan access token");
    }
    return { adminUserId: payload.sub, role: payload.role };
  }
}
