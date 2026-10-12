/** Cocok PERSIS dengan hasil UsersService.findByIdOrThrow -- kalau field di
 * sana berubah, tipe ini harus diupdate juga (tidak di-generate otomatis dari
 * situ, disengaja tetap eksplisit di sini supaya plugin CLI @nestjs/swagger
 * bisa menghasilkan skema respons GET/PATCH /me, lihat catatan di
 * common/dto/token-pair.dto.ts soal kenapa anotasi tipe balik eksplisit
 * dibutuhkan). passwordHash SENGAJA tidak ada di sini (dan tidak ada di select
 * service-nya) -- jangan pernah ditambah balik. `className` = nama kelas hasil
 * relasi (AC AUTH-04: "murid melihat nama kelasnya di profil"). */
export class MeDto {
  id!: string;
  name!: string;
  email!: string;
  avatarUrl!: string | null;
  classId!: string;
  className!: string;
  dailyXpGoal!: number;
  status!: string;
  createdAt!: Date;
  lastActiveAt!: Date | null;
}
