import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SrsModule } from "../srs/srs.module";
import { FlashcardsController } from "./flashcards.controller";
import { FlashcardsService } from "./flashcards.service";

@Module({
  imports: [AuthModule, SrsModule],
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
})
export class FlashcardsModule {}
