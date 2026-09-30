import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.validation";
import { AudioService, OBJECT_STORAGE } from "./audio.service";
import { createAudioStorage } from "./audio-storage";
import { resolveStorageOptions, storageEnvFromConfig } from "./storage-options";
import { ttsClientFromConfig } from "./tts-factory";
import { TtsClient } from "./tts-client";

@Module({
  providers: [
    AudioService,
    {
      provide: TtsClient,
      useFactory: (config: ConfigService<Env, true>) => ttsClientFromConfig(config),
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
