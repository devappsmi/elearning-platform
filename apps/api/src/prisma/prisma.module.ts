import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/** @Global(): every module needs DB access, and re-importing PrismaModule
 * everywhere would just be boilerplate -- see plan section 3. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
