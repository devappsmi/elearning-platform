import { useRef } from "react";
import type { FormEvent, RefObject } from "react";
import { formatElapsed, TUTOR_MAX_TURN_CHARS } from "../../lib/tutor-chat";
import type { RecorderStatus } from "../../lib/use-voice-recorder";
import { fieldClasses } from "../TextField";
import { Button } from "../ui/Button";
import { Icon } from "../ui/icons";

/** Apa yang sedang ditunggu layar: `idle` = murid bebas bertindak; `transcribing` = rekaman sedang dikenali; `replying` = AI sedang menjawab. */
export type ChatPhase = "idle" | "transcribing" | "replying";

export interface ComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  /** Isi kolom berasal dari hasil rekaman: tampilkan ajakan untuk memeriksanya. */
  draftFromVoice: boolean;
  onSend: () => void;
  onHelp: () => void;
  onMicToggle: () => void;
  recorderStatus: RecorderStatus;
  elapsedMs: number;
  maxRecordingSeconds: number;
  /** false = rekam suara tidak bisa dipakai (browser/alamat/ditolak): tombol mikrofon dimatikan, mengetik tetap jalan. */
  micAvailable: boolean;
  phase: ChatPhase;
  characterName: string;
  /** Seluruh isian dimatikan (jatah habis atau AI belum aktif). */
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement>;
}

function statusText(props: Pick<ComposerProps, "recorderStatus" | "elapsedMs" | "maxRecordingSeconds" | "phase" | "characterName">): string | null {
  if (props.recorderStatus === "starting") return "Menunggu izin mikrofon...";
  if (props.recorderStatus === "recording") {
    return `Merekam ${formatElapsed(props.elapsedMs)} dari ${formatElapsed(props.maxRecordingSeconds * 1000)}. Tekan tombol merah untuk berhenti.`;
  }
  if (props.phase === "transcribing") return "Mengenali suaramu...";
  if (props.phase === "replying") return `${props.characterName} sedang menjawab...`;
  return null;
}

/** Kotak kirim di bawah percakapan: tombol mikrofon (rekam), kolom ketik, tombol kirim, dan permintaan contoh jawaban. */
export function Composer(props: ComposerProps) {
  const { draft, onDraftChange, draftFromVoice, onSend, onHelp, onMicToggle, recorderStatus, micAvailable, phase, disabled, inputRef } = props;
  const composingRef = useRef(false);
  const recording = recorderStatus === "recording";
  const idle = phase === "idle" && recorderStatus === "idle";
  const status = statusText(props);
  const canSend = !disabled && phase === "idle" && recorderStatus === "idle" && draft.trim().length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSend) onSend();
  }

  return (
    <div className="rounded-3xl border border-secondary-100 bg-white/95 p-3 shadow-[0_-8px_30px_-12px_theme(colors.primary.600/35%)] backdrop-blur md:p-4">
      <p role="status" aria-live="polite" className={`min-h-5 px-1 pb-1 text-sm font-bold ${recording ? "text-rose-700" : "text-secondary-800"}`}>
        {status ?? (draftFromVoice && draft ? "Begini yang terdengar. Perbaiki kalau ada yang salah, lalu kirim." : "")}
      </p>
      <form onSubmit={submit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMicToggle}
          disabled={disabled || !micAvailable || !(recording || idle)}
          aria-pressed={recording}
          aria-label={recording ? "Berhenti merekam" : "Mulai merekam suara"}
          title={micAvailable ? undefined : "Rekam suara tidak tersedia di sini. Kamu bisa mengetik."}
          data-testid="mic-button"
          className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-full text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            recording
              ? "bg-rose-600 shadow-[0_4px_0_0_#881337] motion-safe:animate-pulse"
              : "bg-gradient-to-br from-primary-600 via-secondary-600 to-tertiary-600 shadow-[0_4px_0_0_theme(colors.secondary.900)] active:translate-y-1 active:shadow-none"
          }`}
        >
          <Icon name={recording ? "stop" : "mic"} className="h-7 w-7" strokeWidth={2.2} />
        </button>
        <input
          ref={inputRef}
          type="text"
          lang="ja"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(event) => {
            // Enter yang dipakai untuk memastikan huruf Jepang (IME) tidak boleh ikut mengirim pesan.
            if (event.key === "Enter" && (composingRef.current || event.nativeEvent.isComposing)) event.preventDefault();
          }}
          maxLength={TUTOR_MAX_TURN_CHARS}
          disabled={disabled || phase !== "idle" || recorderStatus !== "idle"}
          autoComplete="off"
          enterKeyHint="send"
          aria-label="Pesanmu dalam bahasa Jepang"
          placeholder="Ketik di sini"
          data-testid="chat-input"
          className={`${fieldClasses} min-w-0 flex-1 !py-3.5 text-lg`}
        />
        <Button type="submit" size="md" disabled={!canSend} aria-label="Kirim pesan" data-testid="send-button" className="!h-14 !min-h-14 !w-14 !rounded-full !px-0">
          <Icon name="send" className="h-6 w-6" strokeWidth={2.2} />
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 px-1">
        <button
          type="button"
          onClick={onHelp}
          disabled={disabled || !idle}
          data-testid="help-button"
          className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-1 text-sm font-extrabold text-secondary-800 transition hover:bg-secondary-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="sparkles" className="h-4 w-4" strokeWidth={2.4} />
          Minta contoh jawaban
        </button>
        <p className="text-xs font-semibold text-slate-600">Memakai 1 jatah balasan.</p>
      </div>
    </div>
  );
}
