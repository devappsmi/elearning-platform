import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from "./dto/class.dto";

/** ADM-20: CRUD kelas. "Arsipkan kelas (data murid tetap ada, read-only)" --
 * arsip cuma ganti status, TIDAK menghapus/melepas murid dari kelasnya
 * (User.classId tidak pernah diubah oleh archive). "Read-only" untuk kelas
 * arsip artinya endpoint TULIS lain (mis. AdminInvitationsModule) menolak
 * kelas berstatus ARCHIVED sebagai target baru -- lihat assertActiveClass. */
@Injectable()
export class AdminClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClassDto) {
    if (dto.targetLevelId) await this.assertLevelExists(dto.targetLevelId);
    return this.prisma.class.create({
      data: { name: dto.name, targetLevelId: dto.targetLevelId, description: dto.description },
      include: { targetLevel: true },
    });
  }

  async list(query: ListClassesQueryDto) {
    return this.prisma.class.findMany({
      where: { status: query.status },
      include: { targetLevel: true, _count: { select: { students: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async detail(id: string) {
    const klass = await this.prisma.class.findUnique({
      where: { id },
      include: {
        targetLevel: true,
        students: { select: { id: true, name: true, email: true, status: true, lastActiveAt: true } },
      },
    });
    if (!klass) throw new NotFoundException(`Kelas tidak ditemukan: ${id}`);
    return klass;
  }

  async update(id: string, dto: UpdateClassDto) {
    await this.assertExists(id);
    if (dto.targetLevelId) await this.assertLevelExists(dto.targetLevelId);
    return this.prisma.class.update({
      where: { id },
      data: { name: dto.name, targetLevelId: dto.targetLevelId, description: dto.description },
      include: { targetLevel: true },
    });
  }

  async archive(id: string) {
    await this.assertExists(id);
    return this.prisma.class.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  async unarchive(id: string) {
    await this.assertExists(id);
    return this.prisma.class.update({ where: { id }, data: { status: "ACTIVE" } });
  }

  /** Dipakai modul lain (AdminInvitationsModule) yang perlu memastikan target
   * kelas ada DAN masih aktif sebelum mengundang murid baru ke situ. */
  async assertActiveClass(id: string): Promise<{ id: string; name: string }> {
    const klass = await this.prisma.class.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!klass) throw new NotFoundException(`Kelas tidak ditemukan: ${id}`);
    if (klass.status === "ARCHIVED") throw new BadRequestException(`Kelas '${klass.name}' sudah diarsipkan -- tidak bisa jadi target undangan baru`);
    return klass;
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.class.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Kelas tidak ditemukan: ${id}`);
  }

  private async assertLevelExists(levelId: string): Promise<void> {
    const exists = await this.prisma.level.findUnique({ where: { id: levelId }, select: { id: true } });
    if (!exists) throw new BadRequestException(`Level tidak ditemukan: ${levelId}`);
  }
}
