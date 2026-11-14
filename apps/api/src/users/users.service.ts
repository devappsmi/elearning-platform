import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateMeDto } from "./dto/update-me.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        classId: true,
        class: { select: { name: true } },
        dailyXpGoal: true,
        status: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });
    if (!user) throw new NotFoundException("User tidak ditemukan");
    // Ratakan relasi jadi `className` -- objek `class` mentah tidak ikut ke respons.
    const { class: klass, ...rest } = user;
    return { ...rest, className: klass.name };
  }

  /** Field DIPILIH satu per satu -- JANGAN `data: dto`. Tanpa pemilihan ini
   * setiap kolom `User` bisa ditulis murid sendiri lewat `PATCH /me`
   * (`classId`, `email`, `status`, `passwordHash`, ...): dulu memang begitu,
   * karena body masuk mentah ke Prisma (lihat docs/PLAN.md bagian 6e --
   * dibuktikan sungguhan: murid memindahkan dirinya ke kelas lain dan
   * mengganti emailnya tanpa verifikasi). `ValidationPipe` global kini
   * menolak field tak dikenal, tapi penulisan ke DB tidak boleh BERGANTUNG
   * pada pipe itu -- kalau pipe hilang lagi, hanya tiga field ini yang bisa
   * lolos. Prisma mengabaikan nilai `undefined`. */
  async update(userId: string, dto: UpdateMeDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, avatarUrl: dto.avatarUrl, dailyXpGoal: dto.dailyXpGoal },
    });
    return this.findByIdOrThrow(userId);
  }
}
