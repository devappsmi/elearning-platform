import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";
import { AudioService, OBJECT_STORAGE } from "./audio.service";
import { AzureTtsClient } from "./azure-tts.client";
import { ObjectStorageService } from "./object-storage.service";
import { TtsClient } from "./tts-client";

@Module({
  providers: [
    AudioService,
    {
      provide: TtsClient,
      useFactory: (config: ConfigService<Env, true>) =>
        new AzureTtsClient(
          config.get("AZURE_SPEECH_KEY", { infer: true }),
          config.get("AZURE_SPEECH_REGION", { infer: true }),
          config.get("AZURE_TTS_VOICE_FEMALE", { infer: true }),
          config.get("AZURE_TTS_VOICE_MALE", { infer: true }),
        ),
      inject: [ConfigService],
    },
    {
      provide: OBJECT_STORAGE,
      useFactory: (config: ConfigService<Env, true>) =>
        new ObjectStorageService(
          config.get("S3_ENDPOINT", { infer: true }),
          config.get("S3_REGION", { infer: true }),
          config.get("S3_BUCKET", { infer: true }),
          config.get("S3_ACCESS_KEY_ID", { infer: true }),
          config.get("S3_SECRET_ACCESS_KEY", { infer: true }),
          config.get("S3_PUBLIC_BASE_URL", { infer: true }),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [AudioService],
})
export class AudioModule {}
