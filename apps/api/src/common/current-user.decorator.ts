import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/** Baca req.user.userId -- diisi JwtStudentStrategy.validate() setelah
 * JwtStudentAuthGuard lolos. Cuma untuk endpoint SISI MURID; admin punya
 * decorator/strategy sendiri (JwtAdminStrategy mengisi req.user.adminUserId). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user: { userId: string } }>();
  return request.user.userId;
});
