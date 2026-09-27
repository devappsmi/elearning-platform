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
        dailyXpGoal: true,
        status: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });
    if (!user) throw new NotFoundException("User tidak ditemukan");
    return user;
  }

  async update(userId: string, dto: UpdateMeDto) {
    await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.findByIdOrThrow(userId);
  }
}
