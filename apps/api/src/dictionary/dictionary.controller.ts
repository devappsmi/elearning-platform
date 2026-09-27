import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { DictionaryService } from "./dictionary.service";
import { SearchDictionaryQueryDto } from "./dto/search-dictionary.dto";

@Controller("dictionary")
@UseGuards(JwtStudentAuthGuard)
export class DictionaryController {
  constructor(private readonly dictionary: DictionaryService) {}

  @Get()
  search(@Query() query: SearchDictionaryQueryDto) {
    return this.dictionary.search(query.q);
  }
}
