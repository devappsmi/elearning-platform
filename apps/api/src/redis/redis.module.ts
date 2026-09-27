import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { Env } from "../config/env.validation";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

/** Raw ioredis client, not @nestjs/cache-manager -- the leaderboard (sorted
 * sets) and quota/lockout counters (atomic INCR) need primitives
 * cache-manager's get/set abstraction hides. See plan section 3. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService<Env, true>) => new Redis(config.get("REDIS_URL", { infer: true })),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
