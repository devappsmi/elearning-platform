import { SetMetadata } from "@nestjs/common";
import type { AdminRole } from "@prisma/client";

export const ROLES_KEY = "roles";

/** @Roles('OWNER') di atas endpoint yang cuma boleh diakses owner (kelola
 * admin lain, branding lembaga) -- lihat ADM-02/3.3. Harus dipasang SETELAH
 * JwtAdminAuthGuard (guard ini baca req.user.role yang diisi strategy). */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
