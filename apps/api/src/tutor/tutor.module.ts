import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import type { Env } from "../config/env.validation";
import { AudioModule } from "../audio/audio.module";
import { AuthModule } from "../auth/auth.module";
import { REDIS_CLIENT } from "../redis/redis.module";
import { TutorController } from "./tutor.controller";
import { TutorService } from "./tutor.service";
import { RedisTutorQuota, TutorQuota } from "./tutor-quota";
import { OpenAiTutorLlmClient, TutorLlmClient, UnconfiguredTutorLlmClient } from "./tutor-llm.client";
import { OpenAiSpeechToTextClient, SpeechToTextClient, UnconfiguredSpeechToTextClient } from "./tutor-stt.client";
import { OpenAiTutorTtsClient, TutorTtsClient, UnconfiguredTutorTtsClient } from "./tutor-tts.client";

/** `OPENAI_API_KEY` kosong bukan error boot -- server tetap jalan, ketiga
 * klien jadi varian "unconfigured" dan endpoint yang memerlukannya
 * menjawab 503 dengan pesan jelas (pola sama Azure TTS di AudioModule). */
function openAiKey(config: ConfigService<Env, true>): string | undefined {
  return config.get("OPENAI_API_KEY", { infer: true })?.trim() || undefined;
}

@Module({
  imports: [AuthModule, AudioModule],
  controllers: [TutorController],
  providers: [
    TutorService,
    {
      provide: TutorQuota,
      useFactory: (redis: Redis, config: ConfigService<Env, true>) =>
        new RedisTutorQuota(redis, config.get("TUTOR_DAILY_QUOTA", { infer: true })),
      inject: [REDIS_CLIENT, ConfigService],
    },
    {
      provide: TutorLlmClient,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = openAiKey(config);
        return apiKey ? new OpenAiTutorLlmClient(apiKey, config.get("OPENAI_CHAT_MODEL", { infer: true })) : new UnconfiguredTutorLlmClient();
      },
      inject: [ConfigService],
    },
    {
      provide: SpeechToTextClient,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = openAiKey(config);
        return apiKey ? new OpenAiSpeechToTextClient(apiKey, config.get("OPENAI_STT_MODEL", { infer: true })) : new UnconfiguredSpeechToTextClient();
      },
      inject: [ConfigService],
    },
    {
      provide: TutorTtsClient,
      useFactory: (config: ConfigService<Env, true>) => {
        const apiKey = openAiKey(config);
        const defaultVoice = config.get("OPENAI_TTS_VOICE_DEFAULT", { infer: true });
        return apiKey
          ? new OpenAiTutorTtsClient(apiKey, config.get("OPENAI_TTS_MODEL", { infer: true }), defaultVoice)
          : new UnconfiguredTutorTtsClient(defaultVoice);
      },
      inject: [ConfigService],
    },
  ],
})
export class TutorModule {}
