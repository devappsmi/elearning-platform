import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";

/** Baca req.user.{adminUserId,role} -- diisi JwtAdminStrategy.validate()
 * setelah JwtAdminAuthGuard lolos. Padanan CurrentUser tapi untuk endpoint
 * SISI ADMIN; jangan dipakai di controller murid. */
export const CurrentAdmin = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): { adminUserId: string; role: AdminRole } => {
    const request = ctx.switchToHttp().getRequest<{ user: { adminUserId: string; role: AdminRole } }>();
    return request.user;
  },
);
