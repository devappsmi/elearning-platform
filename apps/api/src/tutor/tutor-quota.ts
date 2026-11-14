import type Redis from "ioredis";
import { nextLocalMidnight, quotaKey, secondsUntilNextMidnight } from "./tutor-quota.util";

export interface TutorQuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
}

/** Seam kuota -- abstract class sebagai token DI (pola sama `TtsClient`/
 * `REDIS_CLIENT`), supaya `TutorService` bisa dites dengan implementasi
 * palsu di memori. Implementasi sungguhan: `RedisTutorQuota`. */
export abstract class TutorQuota {
  abstract readonly limit: number;
  abstract status(userId: string, now: Date): Promise<TutorQuotaStatus>;
  /** Ambil SATU jatah. `null` = kuota habis -- dan TIDAK ada yang
   * dikonsumsi. `now` HARUS sama dengan yang nanti dipakai `refund` supaya
   * pengembalian mengenai counter hari yang sama walau lewat tengah malam. */
  abstract consume(userId: string, now: Date): Promise<TutorQuotaStatus | null>;
  abstract refund(userId: string, now: Date): Promise<void>;
}

// Cek-lalu-naikkan dalam SATU skrip Lua = atomik di sisi Redis -- membetulkan
// race check-then-act versi lama (SQLite: baca jumlah, baru tulis, dua
// request bersamaan sama-sama lolos di batas). Counter TIDAK PERNAH melewati
// limit (tidak ada INCR lalu DECR yang sempat terlihat lewat batas), dan TTL
// dipasang kalau key baru ATAU kehilangan TTL-nya.
const CONSUME_SCRIPT = `
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= limit then
  return -1
end
local n = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return n
`;

// Tidak pernah menurunkan di bawah 0 (mis. refund untuk key yang sudah kedaluwarsa).
const REFUND_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current > 0 then
  return redis.call('DECR', KEYS[1])
end
return 0
`;

export class RedisTutorQuota extends TutorQuota {
  constructor(
    private readonly redis: Redis,
    readonly limit: number,
  ) {
    super();
  }

  private toStatus(used: number, now: Date): TutorQuotaStatus {
    const clamped = Math.min(Math.max(used, 0), this.limit);
    return { limit: this.limit, used: clamped, remaining: this.limit - clamped, resetsAt: nextLocalMidnight(now) };
  }

  async status(userId: string, now: Date): Promise<TutorQuotaStatus> {
    const raw = await this.redis.get(quotaKey(userId, now));
    return this.toStatus(Number(raw ?? 0), now);
  }

  async consume(userId: string, now: Date): Promise<TutorQuotaStatus | null> {
    const result = Number(
      await this.redis.eval(CONSUME_SCRIPT, 1, quotaKey(userId, now), String(this.limit), String(secondsUntilNextMidnight(now))),
    );
    return result < 0 ? null : this.toStatus(result, now);
  }

  async refund(userId: string, now: Date): Promise<void> {
    await this.redis.eval(REFUND_SCRIPT, 1, quotaKey(userId, now));
  }
}
