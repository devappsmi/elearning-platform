import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
import { FlashcardsService } from "./flashcards.service";
import { ReviewFlashcardDto } from "./dto/review-flashcard.dto";

@ApiTags("Flashcards")
@ApiBearerAuth("access-token")
@Controller("flashcards")
@UseGuards(JwtStudentAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcards: FlashcardsService) {}

  @Get("due")
  due(@CurrentUser() userId: string) {
    return this.flashcards.due(userId);
  }

  @Post("review")
  @HttpCode(HttpStatus.OK)
  async review(@CurrentUser() userId: string, @Body() dto: ReviewFlashcardDto) {
    await this.flashcards.review(userId, dto.itemId, dto.correct);
    return { message: "Tercatat." };
  }
}
