import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtStudentAuthGuard } from "../auth/guards/jwt-student-auth.guard";
import { DictionaryService } from "./dictionary.service";
import { SearchDictionaryQueryDto } from "./dto/search-dictionary.dto";

@ApiTags("Dictionary")
@ApiBearerAuth("access-token")
@Controller("dictionary")
@UseGuards(JwtStudentAuthGuard)
export class DictionaryController {
  constructor(private readonly dictionary: DictionaryService) {}

  @Get()
  search(@Query() query: SearchDictionaryQueryDto) {
    return this.dictionary.search(query.q);
  }
}
