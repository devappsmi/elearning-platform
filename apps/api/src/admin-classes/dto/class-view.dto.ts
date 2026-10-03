import { ApiProperty } from "@nestjs/swagger";

/** Bentuk respons AdminClassesModule (ADM-20). `class`, di `dto/*.dto.ts` --
 * lihat catatan lengkap di learning-path/dto/path-view.dto.ts soal kenapa
 * plugin CLI @nestjs/swagger butuh KEDUANYA. Field cocok PERSIS dengan
 * `include`/`select` di admin-classes.service.ts -- kalau itu berubah,
 * DTO ini harus diupdate juga (tidak digenerate otomatis dari situ). */

export class LevelSummaryDto {
  id!: string;
  code!: string;
  name!: string;
  order!: number;
}

// create()/update() -- prisma.class.{create,update} include:{targetLevel:true}.
export class ClassWithLevelDto {
  id!: string;
  name!: string;
  targetLevelId!: string | null;
  targetLevel!: LevelSummaryDto | null;
  description!: string | null;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] })
  status!: "ACTIVE" | "ARCHIVED";
  createdAt!: Date;
  updatedAt!: Date;
}

class StudentCountDto {
  students!: number;
}

// list() -- di atas + _count.students (jumlah murid, bukan daftar penuh).
export class ClassListItemDto extends ClassWithLevelDto {
  _count!: StudentCountDto;
}

class ClassStudentSummaryDto {
  id!: string;
  name!: string;
  email!: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] })
  status!: "ACTIVE" | "INACTIVE";
  lastActiveAt!: Date | null;
}

// detail() -- daftar murid PENUH (bukan cuma hitungan), bukan _count.
export class ClassDetailDto extends ClassWithLevelDto {
  students!: ClassStudentSummaryDto[];
}

// archive()/unarchive() -- prisma.class.update TANPA include, jadi field
// Class polos saja (tidak ada targetLevel/_count/students).
export class ClassDto {
  id!: string;
  name!: string;
  targetLevelId!: string | null;
  description!: string | null;
  @ApiProperty({ enum: ["ACTIVE", "ARCHIVED"] })
  status!: "ACTIVE" | "ARCHIVED";
  createdAt!: Date;
  updatedAt!: Date;
}
