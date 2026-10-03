import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../auth/api-client";
import { ChatBubble } from "../components/tutor/ChatBubble";
import type { BubbleAudioState } from "../components/tutor/ChatBubble";
import { Composer } from "../components/tutor/Composer";
import type { ChatPhase } from "../components/tutor/Composer";
import { TutorSetup } from "../components/tutor/TutorSetup";
import type { TutorCatalog } from "../components/tutor/TutorSetup";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Loading, Notice } from "../components/ui/Feedback";
import type { NoticeTone } from "../components/ui/Feedback";
import { Icon } from "../components/ui/icons";
import { PageHeader } from "../components/ui/PageHeader";
import {
  buildHistory,
  classifyFailure,
  clipTurnText,
  failureText,
  NETWORK_FAILURE,
  openerFor,
  readyDraft,
  recorderProblemText,
  TUTOR_HELP_REQUEST_TEXT,
} from "../lib/tutor-chat";
import type { ChatMessage, TutorAction, TutorFailure, TutorQuota } from "../lib/tutor-chat";
import { useTutorAudio } from "../lib/use-tutor-audio";
import { RECORDING_MAX_SECONDS, useVoiceRecorder } from "../lib/use-voice-recorder";
import type { RecorderStatus, RecordingResult } from "../lib/use-voice-recorder";

type SetupState = { status: "loading" } | { status: "error" } | { status: "ready"; catalog: TutorCatalog };
type NoticeState = { tone: NoticeTone; text: string };
interface AudioInfo {
  state: BubbleAudioState;
  url?: string;
}

/** Ekstensi berkas rekaman menurut format yang dihasilkan browser (server menentukan format dari tipe MIME, bukan namanya). */
function extensionFor(mimeType: string): string {
  if (mimeType.startsWith("audio/mp4")) return "mp4";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  return "webm";
}

/** Memfokuskan kolom ketik hanya di perangkat dengan penunjuk presisi (komputer): di ponsel fokus otomatis membuka keyboard layar. */
function focusOnDesktop(input: HTMLInputElement | null): void {
  if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) input?.focus({ preventScroll: true });
}

/** Ngobrol dengan AI (/conversation/ngobrol-ai): latihan bercakap bebas. Murid memilih situasi dan karakter, lalu bicara lewat
 * mikrofon (rekaman -> POST /tutor/transcribe -> teks yang boleh diperbaiki -> POST /tutor/reply) atau mengetik. Balasan AI
 * dibacakan (POST /tutor/speak). Koreksi kesalahan dilakukan AI sendiri di dalam balasannya (aturan prompt di server). Server tidak
 * menyimpan riwayat: seluruh percakapan hidup di state halaman ini dan dikirim ulang utuh (maks 40 giliran) tiap balasan. */
export function TutorPage() {
  const [setup, setSetup] = useState<SetupState>({ status: "loading" });
  const [quota, setQuota] = useState<TutorQuota | null>(null);
  const [stage, setStage] = useState<"setup" | "chat">("setup");
  const [scenarioId, setScenarioId] = useState("");
  const [characterId, setCharacterId] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [draft, setDraft] = useState("");
  const [draftVia, setDraftVia] = useState<"typed" | "voice">("typed");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [blocked, setBlocked] = useState<"quota" | "not-configured" | null>(null);
  const [voiceBlocked, setVoiceBlocked] = useState(false);
  const [audioInfo, setAudioInfo] = useState<Record<number, AudioInfo>>({});
  const [soundOn, setSoundOn] = useState(true);

  const nextId = useRef(1);
  const mountedRef = useRef(true);
  /** Naik tiap sesi berakhir/diulang: jawaban server yang terlambat dari sesi lama dibuang. */
  const epochRef = useRef(0);
  const soundOnRef = useRef(true);
  const latestReplyIdRef = useRef<number | null>(null);
  const recorderStatusRef = useRef<RecorderStatus>("idle");
  const phaseRef = useRef<ChatPhase>("idle");
  const speakUnavailableRef = useRef(false);
  const autoplayNoticeShownRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { play: playAudio, stop: stopAudio, unlock: unlockAudio, playingId } = useTutorAudio();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      epochRef.current += 1;
    };
  }, []);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ---- Memuat katalog + sisa jatah ----------------------------------------------------------------------------------
  const loadSetup = useCallback(async () => {
    setSetup({ status: "loading" });
    try {
      const [catalogResult, quotaResult] = await Promise.all([apiClient.GET("/tutor/scenarios"), apiClient.GET("/tutor/quota")]);
      if (!mountedRef.current) return;
      if (!catalogResult.data || !quotaResult.data) {
        setSetup({ status: "error" });
        return;
      }
      const catalog = catalogResult.data;
      setSetup({ status: "ready", catalog });
      setQuota(quotaResult.data);
      setScenarioId((current) => current || catalog.scenarios[0]?.id || "");
      setCharacterId((current) => current || catalog.characters[0]?.id || "");
    } catch {
      if (mountedRef.current) setSetup({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  // ---- Galat bersama --------------------------------------------------------------------------------------------------
  const showFailure = useCallback((failure: TutorFailure, action: TutorAction): void => {
    const hard = failure.kind === "quota" || failure.kind === "not-configured";
    setNotice({ tone: hard ? "warning" : "error", text: failureText(failure.kind, action) });
    if (failure.quota) setQuota(failure.quota);
    if (action === "reply" && (failure.kind === "quota" || failure.kind === "not-configured")) setBlocked(failure.kind);
    if (action === "transcribe" && failure.kind === "not-configured") setVoiceBlocked(true);
  }, []);

  // ---- Suara balasan ---------------------------------------------------------------------------------------------------
  const playUrl = useCallback(
    async (id: number, url: string, automatic: boolean) => {
      const result = await playAudio(id, url);
      if (!mountedRef.current) return;
      if (result === "blocked" && automatic) {
        if (!autoplayNoticeShownRef.current) {
          autoplayNoticeShownRef.current = true;
          setNotice({ tone: "info", text: "Browser menahan suara otomatis. Tekan Dengarkan di balasan untuk mendengarnya." });
        }
      } else if (result === "failed") {
        setNotice({ tone: "warning", text: "Suara tidak bisa diputar di perangkat ini." });
      }
    },
    [playAudio],
  );

  const speakReply = useCallback(
    async (message: ChatMessage, epoch: number) => {
      const setInfo = (info: AudioInfo) => setAudioInfo((current) => ({ ...current, [message.id]: info }));
      if (speakUnavailableRef.current) {
        setInfo({ state: "failed" });
        return;
      }
      setInfo({ state: "loading" });
      try {
        const { data, error, response } = await apiClient.POST("/tutor/speak", { body: { text: clipTurnText(message.text), characterId } });
        if (epoch !== epochRef.current || !mountedRef.current) return;
        if (!data) {
          if (classifyFailure(response.status, error).kind === "not-configured") speakUnavailableRef.current = true;
          setInfo({ state: "failed" });
          return;
        }
        setInfo({ state: "ready", url: data.audioUrl });
        if (soundOnRef.current && latestReplyIdRef.current === message.id && recorderStatusRef.current === "idle" && phaseRef.current === "idle") {
          void playUrl(message.id, data.audioUrl, true);
        }
      } catch {
        if (epoch === epochRef.current && mountedRef.current) setInfo({ state: "failed" });
      }
    },
    [characterId, playUrl],
  );

  // ---- Rekaman -> transkripsi ----------------------------------------------------------------------------------------
  const handleRecorded = useCallback(async (result: RecordingResult) => {
    const epoch = epochRef.current;
    setPhase("transcribing");
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", new File([result.blob], `rekaman.${extensionFor(result.mimeType)}`, { type: result.mimeType }));
      const { data, error, response } = await apiClient.POST("/tutor/transcribe", { body: { file: "" }, bodySerializer: () => form });
      if (epoch !== epochRef.current || !mountedRef.current) return;
      if (!data) {
        showFailure(classifyFailure(response.status, error), "transcribe");
        return;
      }
      const text = clipTurnText(data.text);
      if (!text) {
        setNotice({ tone: "warning", text: "Suaramu tidak terdengar jelas. Coba lagi dengan mendekat ke mikrofon, atau ketik jawabanmu." });
        return;
      }
      setDraft(text);
      setDraftVia("voice");
      focusOnDesktop(inputRef.current);
    } catch {
      if (epoch === epochRef.current && mountedRef.current) showFailure(NETWORK_FAILURE, "transcribe");
    } finally {
      if (epoch === epochRef.current && mountedRef.current) setPhase("idle");
    }
  }, [showFailure]);

  const recorder = useVoiceRecorder({ onFinish: handleRecorded });
  useEffect(() => {
    recorderStatusRef.current = recorder.status;
  }, [recorder.status]);

  // ---- Kirim pesan / minta bantuan ---------------------------------------------------------------------------------------
  const blockedReason = blocked ?? (quota && quota.remaining <= 0 ? "quota" : null);

  async function send() {
    const text = readyDraft(draft);
    if (!text || phase !== "idle" || recorder.status !== "idle" || blockedReason) return;
    unlockAudio();
    stopAudio();
    const epoch = epochRef.current;
    const via = draftVia;
    const userMessage: ChatMessage = { id: nextId.current++, role: "user", text: clipTurnText(text), kind: "turn", via };
    const history = buildHistory([...messages, userMessage]);
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setDraftVia("typed");
    setNotice(null);
    setPhase("replying");

    // Pesan yang gagal terkirim ditarik dari percakapan dan dikembalikan ke kolom ketik, supaya bisa dikirim lagi tanpa menggandakan.
    const restore = () => {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setDraft(userMessage.text);
      setDraftVia(via);
    };

    try {
      const { data, error, response } = await apiClient.POST("/tutor/reply", { body: { scenarioId, characterId, history } });
      if (epoch !== epochRef.current || !mountedRef.current) return;
      if (!data) {
        restore();
        showFailure(classifyFailure(response.status, error), "reply");
        return;
      }
      const reply: ChatMessage = { id: nextId.current++, role: "assistant", text: data.reply.trim(), kind: "turn" };
      latestReplyIdRef.current = reply.id;
      setMessages((current) => [...current, reply]);
      setQuota(data.quota);
      void speakReply(reply, epoch);
    } catch {
      if (epoch === epochRef.current && mountedRef.current) {
        restore();
        showFailure(NETWORK_FAILURE, "reply");
      }
    } finally {
      if (epoch === epochRef.current && mountedRef.current) setPhase("idle");
    }
  }

  async function askHelp() {
    if (phase !== "idle" || recorder.status !== "idle" || blockedReason) return;
    unlockAudio();
    stopAudio();
    const epoch = epochRef.current;
    setNotice(null);
    setPhase("replying");
    try {
      const { data, error, response } = await apiClient.POST("/tutor/reply", {
        body: { scenarioId, characterId, mode: "help", history: buildHistory(messages, TUTOR_HELP_REQUEST_TEXT) },
      });
      if (epoch !== epochRef.current || !mountedRef.current) return;
      if (!data) {
        showFailure(classifyFailure(response.status, error), "reply");
        return;
      }
      setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text: data.reply.trim(), kind: "tip" }]);
      setQuota(data.quota);
    } catch {
      if (epoch === epochRef.current && mountedRef.current) showFailure(NETWORK_FAILURE, "reply");
    } finally {
      if (epoch === epochRef.current && mountedRef.current) setPhase("idle");
    }
  }

  function toggleMic() {
    unlockAudio();
    if (recorder.status === "recording") {
      recorder.stop();
      return;
    }
    if (recorder.status !== "idle" || phase !== "idle" || blockedReason) return;
    stopAudio();
    setNotice(null);
    recorder.clearError();
    void recorder.start();
  }

  function playOrStop(message: ChatMessage) {
    const info = audioInfo[message.id];
    if (!info?.url) return;
    unlockAudio();
    if (playingId === message.id) stopAudio();
    else void playUrl(message.id, info.url, false);
  }

  // ---- Memulai / mengakhiri sesi ---------------------------------------------------------------------------------------
  function resetChat() {
    epochRef.current += 1;
    recorder.cancel();
    stopAudio();
    latestReplyIdRef.current = null;
    setMessages([]);
    setAudioInfo({});
    setDraft("");
    setDraftVia("typed");
    setNotice(null);
    setPhase("idle");
    setBlocked(null);
  }

  function startChat() {
    unlockAudio();
    resetChat();
    setStage("chat");
  }

  function endChat() {
    resetChat();
    setStage("setup");
  }

  function toggleSound() {
    if (soundOn) stopAudio();
    setSoundOn(!soundOn);
  }

  // Gulir ke pesan terbaru (kotak kirim yang menempel di bawah diberi ruang lewat scroll-mb di penanda ujung).
  useEffect(() => {
    if (stage !== "chat") return;
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [stage, messages.length, phase]);

  // ---- Tampilan --------------------------------------------------------------------------------------------------------
  if (setup.status === "loading") return <Loading />;

  if (setup.status === "error") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Ngobrol dengan AI" subtitle="Latihan bicara bebas dengan teman bicara AI." emoji="🎙️" tone="pink" />
        <Notice tone="error" role="alert">
          Gagal memuat halaman ini.
        </Notice>
        <div className="mt-4">
          <Button onClick={() => void loadSetup()}>
            <Icon name="refresh" className="h-5 w-5" />
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  const { catalog } = setup;
  const scenario = catalog.scenarios.find((s) => s.id === scenarioId);
  const character = catalog.characters.find((c) => c.id === characterId);
  const micSupportNotice = recorder.support.supported ? null : recorderProblemText(recorder.support.reason);
  const voiceNotice = micSupportNotice ?? (voiceBlocked ? failureText("not-configured", "transcribe") : null);

  if (stage === "setup" || !scenario || !character || !quota) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/conversation" className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-secondary-700 hover:underline">
          <Icon name="arrowRight" className="h-4 w-4 rotate-180" strokeWidth={2.6} />
          Kembali ke Percakapan
        </Link>
        <PageHeader
          title="Ngobrol dengan AI"
          subtitle="Latihan bicara bebas. Ucapkan atau ketik kalimat Jepang, AI membalas dan membetulkan kalau ada yang kurang tepat."
          emoji="🎙️"
          tone="pink"
        />
        {quota ? (
          <TutorSetup
            catalog={catalog}
            quota={quota}
            scenarioId={scenarioId}
            characterId={characterId}
            onScenarioChange={setScenarioId}
            onCharacterChange={setCharacterId}
            onStart={startChat}
            voiceNotice={voiceNotice}
          />
        ) : null}
      </div>
    );
  }

  const recorderNotice: NoticeState | null = recorder.error ? { tone: "error", text: recorderProblemText(recorder.error) } : null;
  const shownNotice = notice ?? recorderNotice;
  const blockedNotice: NoticeState | null = blockedReason ? { tone: "warning", text: failureText(blockedReason, "reply") } : null;
  const lowQuota = quota.remaining <= 3;

  // Tinggi minimum membuat kotak kirim berada di dasar layar walau percakapan masih pendek (dikurangi bilah atas, ruang tab bawah,
  // dan padding halaman). `-mb-7` membuang kelebihan padding bawah di HP supaya halaman tidak bergulir saat percakapan kosong.
  return (
    <div className="mx-auto -mb-7 flex min-h-[calc(100dvh_-_10rem_-_env(safe-area-inset-bottom))] max-w-3xl flex-col md:mb-0 md:min-h-[calc(100dvh_-_6rem)]">
      <header className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={endChat}
          aria-label="Selesai ngobrol"
          data-testid="end-chat"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-rose-600 hover:shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
        >
          <Icon name="x" className="h-6 w-6" strokeWidth={2.8} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black leading-tight text-slate-900">{scenario.title}</h1>
          <p className="truncate text-sm font-bold text-slate-600">Bersama {character.name}</p>
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Matikan suara balasan" : "Nyalakan suara balasan"}
          data-testid="sound-toggle"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-secondary-700 shadow-card transition hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
        >
          <Icon name={soundOn ? "speaker" : "speakerOff"} className="h-5 w-5" strokeWidth={2.4} />
        </button>
        <Chip tone={lowQuota ? "amber" : "secondary"} aria-label={`Sisa jatah balasan hari ini: ${quota.remaining} dari ${quota.limit}`} data-testid="quota-chip">
          Sisa {quota.remaining}
        </Chip>
      </header>

      <div role="log" aria-label="Percakapan" aria-live="polite" className="flex-1 space-y-4 pb-4">
        {messages.length === 0 && (
          <Card tone="pink" padding="md" className="space-y-3 text-center" data-testid="empty-chat">
            <p aria-hidden="true" className="text-4xl motion-safe:animate-float">
              🎙️
            </p>
            <p className="text-lg font-black text-slate-900">Mulai dengan menyapa {character.name}</p>
            <p className="text-sm font-semibold text-slate-700">
              Tekan tombol mikrofon lalu ucapkan kalimat Jepang, atau ketik di kolom bawah. Contoh pembuka:
            </p>
            <p lang="ja" className="text-2xl font-black text-slate-900">
              {openerFor(scenario.id)}
            </p>
            <Button
              variant="secondary"
              size="sm"
              data-testid="use-opener"
              onClick={() => {
                setDraft(openerFor(scenario.id));
                setDraftVia("typed");
                focusOnDesktop(inputRef.current);
              }}
            >
              Pakai contoh ini
            </Button>
          </Card>
        )}

        {messages.map((message) => {
          const info = audioInfo[message.id];
          return (
            <ChatBubble
              key={message.id}
              message={message}
              characterName={character.name}
              audioState={message.role === "assistant" && message.kind === "turn" ? (info?.state ?? "none") : "none"}
              playing={playingId === message.id}
              onPlay={() => playOrStop(message)}
            />
          );
        })}

        {phase === "replying" && (
          <div className="flex items-end gap-2" data-testid="typing">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-600 to-rose-600 text-sm font-black text-white shadow-card"
            >
              {Array.from(character.name)[0]?.toUpperCase()}
            </span>
            <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg border border-secondary-100 bg-white px-4 py-4 shadow-card">
              <span className="sr-only">{character.name} sedang menjawab</span>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-secondary-400 motion-safe:animate-bounce"
                  style={{ animationDelay: `${dot * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} className="scroll-mb-72" />
      </div>

      <div className="sticky bottom-[calc(5.25rem_+_env(safe-area-inset-bottom))] z-20 space-y-2 md:bottom-14">
        {voiceNotice && <Notice tone="info">{voiceNotice}</Notice>}
        {blockedNotice ? (
          <Notice tone={blockedNotice.tone} role="alert">
            {blockedNotice.text}
          </Notice>
        ) : (
          shownNotice && (
            <Notice tone={shownNotice.tone} role="alert">
              {shownNotice.text}
            </Notice>
          )
        )}
        <Composer
          draft={draft}
          onDraftChange={(value) => {
            setDraft(value);
            // Hasil rekaman yang diperbaiki tetap berasal dari suara; mengosongkan kolom berarti mulai mengetik pesan baru.
            if (value.trim() === "") setDraftVia("typed");
          }}
          draftFromVoice={draftVia === "voice"}
          onSend={() => void send()}
          onHelp={() => void askHelp()}
          onMicToggle={toggleMic}
          recorderStatus={recorder.status}
          elapsedMs={recorder.elapsedMs}
          maxRecordingSeconds={RECORDING_MAX_SECONDS}
          micAvailable={recorder.support.supported && !voiceBlocked}
          phase={phase}
          characterName={character.name}
          disabled={blockedReason !== null}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
