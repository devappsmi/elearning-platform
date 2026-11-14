// Bentuk respons GET /tutor/scenarios. `class`, di `dto/*.dto.ts` -- lihat
// catatan lengkap di learning-path/dto/path-view.dto.ts soal kenapa plugin
// CLI @nestjs/swagger butuh KEDUANYA. `systemPrompt`/`voice`/
// `voiceInstructions` SENGAJA tidak ada di sini -- detail implementasi
// server, bukan konsumsi client.
export class TutorScenarioDto {
  id!: string;
  title!: string;
  description!: string;
}

export class TutorCharacterDto {
  id!: string;
  name!: string;
  personality!: string;
}

export class TutorCatalogDto {
  scenarios!: TutorScenarioDto[];
  characters!: TutorCharacterDto[];
}
