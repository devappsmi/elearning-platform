import type { components } from "@elearning/api-client";
import type { TutorQuota } from "../../lib/tutor-chat";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Notice } from "../ui/Feedback";
import { Icon } from "../ui/icons";

export type TutorCatalog = components["schemas"]["TutorCatalogDto"];

// Ikon situasi (hiasan saja). Situasi baru yang belum punya ikon memakai gelembung percakapan umum.
const SCENARIO_EMOJI: Record<string, string> = { perkenalan: "🙋", restoran: "🍜", arah: "🧭", belanja: "🛍️" };

export interface TutorSetupProps {
  catalog: TutorCatalog;
  quota: TutorQuota;
  scenarioId: string;
  characterId: string;
  onScenarioChange: (id: string) => void;
  onCharacterChange: (id: string) => void;
  onStart: () => void;
  /** Penjelasan bila rekam suara tidak bisa dipakai (alamat bukan HTTPS, browser lama). */
  voiceNotice: string | null;
}

const OPTION_BOX =
  "flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 transition hover:border-secondary-300 peer-checked:border-secondary-500 peer-checked:bg-secondary-50 peer-focus-visible:ring-4 peer-focus-visible:ring-secondary-300";

/** Tahap memilih sebelum ngobrol: situasi, teman bicara (karakter), dan sisa jatah hari ini. */
export function TutorSetup({ catalog, quota, scenarioId, characterId, onScenarioChange, onCharacterChange, onStart, voiceNotice }: TutorSetupProps) {
  const exhausted = quota.remaining <= 0;
  return (
    <div className="space-y-6">
      <Card tone="primary" padding="sm" className="space-y-2">
        <p className="text-base font-extrabold text-slate-900">Cara kerjanya</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold text-slate-700">
          <li>Pilih situasi dan teman bicara.</li>
          <li>Ucapkan kalimat Jepang lewat mikrofon, atau ketik kalau mau.</li>
          <li>AI membalas dengan tulisan dan suara. Kalau kalimatmu kurang tepat, AI membetulkannya lewat balasannya.</li>
        </ol>
      </Card>

      {voiceNotice && <Notice tone="info">{voiceNotice}</Notice>}

      <fieldset className="space-y-3">
        <legend className="mb-1 text-lg font-black text-slate-900">Pilih situasi</legend>
        {catalog.scenarios.map((scenario) => (
          <label key={scenario.id} className="block cursor-pointer">
            <input
              type="radio"
              name="tutor-scenario"
              value={scenario.id}
              checked={scenarioId === scenario.id}
              onChange={() => onScenarioChange(scenario.id)}
              className="peer sr-only"
            />
            <span className={OPTION_BOX}>
              <span aria-hidden="true" className="text-3xl leading-none">
                {SCENARIO_EMOJI[scenario.id] ?? "💬"}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-extrabold text-slate-900">{scenario.title}</span>
                <span className="block text-sm font-semibold text-slate-600">{scenario.description}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-lg font-black text-slate-900">Pilih teman bicara</legend>
        {catalog.characters.map((character) => (
          <label key={character.id} className="block cursor-pointer">
            <input
              type="radio"
              name="tutor-character"
              value={character.id}
              checked={characterId === character.id}
              onChange={() => onCharacterChange(character.id)}
              className="peer sr-only"
            />
            <span className={OPTION_BOX}>
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-600 to-rose-600 text-base font-black text-white"
              >
                {Array.from(character.name)[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-extrabold text-slate-900">{character.name}</span>
                <span className="block text-sm font-semibold text-slate-600">{character.personality}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={exhausted ? "rose" : "secondary"} data-testid="quota-chip">
            <Icon name="bolt" className="h-4 w-4" />
            Sisa jatah hari ini: {quota.remaining} dari {quota.limit} balasan
          </Chip>
        </div>
        {exhausted && (
          <Notice tone="warning" role="status">
            Jatah ngobrol hari ini sudah habis. Jatahmu kembali besok.
          </Notice>
        )}
        <Button size="lg" block disabled={exhausted} onClick={onStart} data-testid="start-chat">
          <Icon name="mic" className="h-5 w-5" strokeWidth={2.4} />
          Mulai Ngobrol
        </Button>
      </div>
    </div>
  );
}
