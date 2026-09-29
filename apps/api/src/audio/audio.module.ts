import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";
import { AudioService, OBJECT_STORAGE } from "./audio.service";
import { AzureTtsClient } from "./azure-tts.client";
import { createAudioStorage } from "./audio-storage";
import { resolveStorageOptions, storageEnvFromConfig } from "./storage-options";
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
        createAudioStorage(
          resolveStorageOptions(storageEnvFromConfig(config)),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [AudioService],
})
export class AudioModule {}
