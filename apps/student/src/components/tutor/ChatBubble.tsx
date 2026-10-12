import { langOf } from "../../lib/lang";
import type { ChatMessage } from "../../lib/tutor-chat";
import { Icon } from "../ui/icons";

/** Keadaan suara sebuah balasan AI: `none` = belum diminta, `loading` = sedang dibuat, `ready` = siap diputar, `failed` = tidak tersedia. */
export type BubbleAudioState = "none" | "loading" | "ready" | "failed";

export interface ChatBubbleProps {
  message: ChatMessage;
  characterName: string;
  /** Hanya balasan AI. */
  audioState?: BubbleAudioState;
  playing?: boolean;
  onPlay?: () => void;
}

/** Satu gelembung percakapan: murid di kanan (warna merek), AI di kiri (putih), kartu contoh jawaban lebar penuh. */
export function ChatBubble({ message, characterName, audioState = "none", playing = false, onPlay }: ChatBubbleProps) {
  if (message.kind === "tip") {
    return (
      <section data-testid="tip-message" aria-label="Contoh jawaban" className="rounded-3xl border-2 border-sky-200 bg-sky-50 px-4 py-3 text-slate-800">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-sky-900">
          <Icon name="sparkles" className="h-4 w-4" strokeWidth={2.4} />
          Contoh jawaban dari {characterName}
        </p>
        <p className="mt-1.5 whitespace-pre-line text-base font-semibold leading-relaxed [overflow-wrap:anywhere]">{message.text}</p>
      </section>
    );
  }

  if (message.role === "user") {
    return (
      <div data-testid="user-message" className="flex justify-end">
        <div className="max-w-[88%] rounded-3xl rounded-br-lg bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600 px-4 py-3 text-white shadow-card">
          <p lang={langOf(message.text)} className="text-lg font-bold leading-snug [overflow-wrap:anywhere]">
            {message.text}
          </p>
          {message.via === "voice" && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-white">
              <Icon name="mic" className="h-3.5 w-3.5" strokeWidth={2.4} />
              dari suara
            </p>
          )}
        </div>
      </div>
    );
  }

  const initial = Array.from(characterName)[0]?.toUpperCase() ?? "?";
  return (
    <div data-testid="ai-message" className="flex items-end gap-2">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-600 to-rose-600 text-sm font-black text-white shadow-card"
      >
        {initial}
      </span>
      <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-secondary-100 bg-white px-4 py-3 shadow-card">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">{characterName}</p>
        <p lang={langOf(message.text)} className="mt-0.5 text-lg font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">
          {message.text}
        </p>
        {audioState === "ready" && (
          <button
            type="button"
            onClick={onPlay}
            aria-label={playing ? "Suara sedang diputar" : "Dengarkan balasan"}
            data-testid="play-reply"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-secondary-100 px-3 py-1.5 text-sm font-extrabold text-secondary-800 transition hover:bg-secondary-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
          >
            <Icon name="speaker" className={`h-4 w-4 ${playing ? "motion-safe:animate-pulse" : ""}`} strokeWidth={2.4} />
            {playing ? "Memutar..." : "Dengarkan"}
          </button>
        )}
        {audioState === "loading" && <p className="mt-2 text-xs font-bold text-slate-600">Menyiapkan suara...</p>}
        {audioState === "failed" && <p className="mt-2 text-xs font-bold text-slate-600">Suara belum tersedia untuk balasan ini.</p>}
      </div>
    </div>
  );
}
