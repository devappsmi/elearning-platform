import { useId } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HIRAGANA_CHART, KATAKANA_CHART } from "@elearning/domain";
import type { KanaSection } from "@elearning/domain";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/icons";
import { PageHeader } from "../components/ui/PageHeader";

/** Tab halaman, juga dipakai sebagai `?tab=` supaya Beranda dan Kamus bisa langsung membuka tabelnya. */
export const KANA_TABS = [
  { id: "pengantar", label: "Pengantar" },
  { id: "hiragana", label: "Hiragana" },
  { id: "katakana", label: "Katakana" },
] as const;
type TabId = (typeof KANA_TABS)[number]["id"];


/**
 * Huruf Jepang: pengantar tiga jenis huruf dan tabel kana per baris konsonan. Ditambahkan setelah evaluasi pengguna
 * (Okt 2026): murid awam langsung diberi soal hiragana tanpa tahu apa itu hiragana, dan tidak ada tabel untuk menghafal.
 */
export function KanaPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: TabId = KANA_TABS.some((t) => t.id === requested) ? (requested as TabId) : "pengantar";
  const baseId = useId();
  const open = (id: TabId) => setParams(id === "pengantar" ? {} : { tab: id }, { replace: true });

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-secondary-700 hover:underline">
        <Icon name="arrowRight" className="h-4 w-4 rotate-180" strokeWidth={2.6} />
        Kembali ke Beranda
      </Link>
      <PageHeader title="Huruf Jepang" subtitle="Kenali tiga jenis huruf, lalu hafalkan kana per baris." emoji="あ" tone="sky" />

      <div role="tablist" aria-label="Bagian halaman" className="mb-5 flex gap-2 rounded-2xl bg-white/70 p-1.5 shadow-card ring-1 ring-secondary-100">
        {KANA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${baseId}-${t.id}-tab`}
            aria-selected={tab === t.id}
            aria-controls={tab === t.id ? `${baseId}-${t.id}-panel` : undefined}
            data-testid={`kana-tab-${t.id}`}
            onClick={() => open(t.id)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300 md:text-base ${
              tab === t.id ? "bg-secondary-600 text-white shadow" : "text-slate-700 hover:bg-secondary-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${baseId}-${tab}-panel`} aria-labelledby={`${baseId}-${tab}-tab`} className="space-y-5">
        {tab === "pengantar" && <Introduction onOpen={open} />}
        {tab === "hiragana" && <ChartView chart={HIRAGANA_CHART} script="hiragana" />}
        {tab === "katakana" && <ChartView chart={KATAKANA_CHART} script="katakana" />}
      </div>
    </div>
  );
}

// ---- Pengantar ----------------------------------------------------------------------------------------------------------

type Script = "hiragana" | "katakana" | "kanji";
const SCRIPT_STYLE: Record<Script, { text: string; chip: string; label: string }> = {
  hiragana: { text: "text-sky-700", chip: "bg-sky-100 text-sky-800 ring-sky-200", label: "Hiragana" },
  katakana: { text: "text-emerald-700", chip: "bg-emerald-100 text-emerald-800 ring-emerald-200", label: "Katakana" },
  kanji: { text: "text-rose-700", chip: "bg-rose-100 text-rose-800 ring-rose-200", label: "Kanji" },
};

/** 私はインドネシア人です。 dipecah per jenis huruf; kanji diberi furigana. */
const EXAMPLE: { text: string; script: Script; reading?: string }[] = [
  { text: "私", script: "kanji", reading: "わたし" },
  { text: "は", script: "hiragana" },
  { text: "インドネシア", script: "katakana" },
  { text: "人", script: "kanji", reading: "じん" },
  { text: "です。", script: "hiragana" },
];

function ScriptCard({ script, name, intro, examples }: { script: Script; name: string; intro: string; examples: [string, string, string][] }) {
  const style = SCRIPT_STYLE[script];
  return (
    <Card padding="md" className="space-y-2" data-testid={`script-${script}`}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span lang="ja" className={`text-2xl font-black ${style.text}`}>
          {name}
        </span>
        <span className="text-base font-black text-slate-900">{style.label}</span>
      </p>
      <p className="text-sm font-semibold leading-relaxed text-slate-700">{intro}</p>
      <ul className="flex flex-wrap gap-2">
        {examples.map(([jp, romaji, arti]) => (
          <li key={jp} className={`rounded-xl px-3 py-1.5 text-sm font-bold ring-1 ${style.chip}`}>
            <span lang="ja" className="text-base font-black">
              {jp}
            </span>{" "}
            {romaji} · {arti}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding="md" className="space-y-3">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      {children}
    </Card>
  );
}

function Introduction({ onOpen }: { onOpen: (tab: TabId) => void }) {
  return (
    <>
      <Section title="Tiga jenis huruf">
        <p className="text-sm font-semibold leading-relaxed text-slate-700">
          Bahasa Jepang ditulis dengan tiga jenis huruf sekaligus. Dalam satu kalimat biasanya ketiganya muncul bersama:
        </p>
        <div className="rounded-2xl bg-slate-50 p-4 text-center ring-1 ring-slate-200" data-testid="example-sentence">
          <p lang="ja" className="text-3xl font-black leading-[1.9]">
            {EXAMPLE.map((part) => (
              <span key={part.text} className={SCRIPT_STYLE[part.script].text}>
                {part.reading ? (
                  <ruby>
                    {part.text}
                    <rp>(</rp>
                    <rt>{part.reading}</rt>
                    <rp>)</rp>
                  </ruby>
                ) : (
                  part.text
                )}
              </span>
            ))}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-700">watashi wa Indoneshia-jin desu · &ldquo;Saya orang Indonesia.&rdquo;</p>
          <p className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-extrabold">
            {(["kanji", "hiragana", "katakana"] as const).map((script) => (
              <span key={script} className={`rounded-full px-2.5 py-1 ring-1 ${SCRIPT_STYLE[script].chip}`}>
                {SCRIPT_STYLE[script].label}
              </span>
            ))}
          </p>
        </div>
      </Section>

      <ScriptCard
        script="hiragana"
        name="ひらがな"
        intro="Huruf dasar. Dipakai untuk kata asli Jepang, partikel (seperti は dan を), dan akhiran kata kerja. Semua bunyi bahasa Jepang bisa ditulis dengan hiragana, dan furigana di atas kanji pun memakai hiragana."
        examples={[
          ["さくら", "sakura", "bunga sakura"],
          ["ありがとう", "arigatou", "terima kasih"],
        ]}
      />
      <ScriptCard
        script="katakana"
        name="カタカナ"
        intro="Bunyinya sama persis dengan hiragana, tetapi bentuknya lebih kaku dan bersudut. Dipakai untuk kata serapan asing, nama orang dan negara asing, serta bunyi tiruan. Bunyi panjang ditulis dengan garis ー."
        examples={[
          ["コーヒー", "koohii", "kopi"],
          ["インドネシア", "Indoneshia", "Indonesia"],
        ]}
      />
      <ScriptCard
        script="kanji"
        name="漢字"
        intro="Huruf dari Tiongkok. Satu huruf mewakili makna dan bisa punya lebih dari satu cara baca. Kanji dipelajari bertahap; bacaannya sering dibantu furigana."
        examples={[
          ["山", "yama", "gunung"],
          ["日本", "Nihon", "Jepang"],
        ]}
      />

      <Section title="Mengapa mulai dari hiragana?">
        <ul className="list-disc space-y-1.5 pl-5 text-sm font-semibold leading-relaxed text-slate-700">
          <li>Hanya 46 huruf dasar, dan semuanya mewakili seluruh bunyi bahasa Jepang.</li>
          <li>Setelah hiragana hafal, katakana tinggal dikenali bentuknya karena bunyinya sama.</li>
          <li>Kanji yang sulit biasanya diberi furigana dalam hiragana, jadi hiragana selalu terpakai.</li>
        </ul>
      </Section>

      <Section title="Cara membaca tabel kana">
        <ul className="list-disc space-y-1.5 pl-5 text-sm font-semibold leading-relaxed text-slate-700">
          <li>Ada lima vokal: a, i, u, e, o, dibaca seperti dalam bahasa Indonesia.</li>
          <li>
            Tiap baris tabel adalah satu konsonan yang digabung dengan kelima vokal itu: <span lang="ja">か き く け こ</span> = ka ki ku ke ko.
          </li>
          <li>
            Beberapa huruf tidak mengikuti pola dan ditandai kuning di tabel, misalnya <span lang="ja">し</span> shi, <span lang="ja">つ</span> tsu,{" "}
            <span lang="ja">ふ</span> fu, dan <span lang="ja">ん</span> n.
          </li>
          <li>
            Tanda ゛ membuat bunyi lebih berat (<span lang="ja">か</span> ka → <span lang="ja">が</span> ga); tanda ゜ hanya untuk baris{" "}
            <span lang="ja">は</span> (<span lang="ja">は</span> ha → <span lang="ja">ぱ</span> pa).
          </li>
          <li>
            <span lang="ja">ゃ/ゅ/ょ</span> kecil menggabungkan dua huruf menjadi satu suku kata: <span lang="ja">きゃ</span> dibaca kya, bukan &ldquo;ki-ya&rdquo;.
          </li>
          <li>
            <span lang="ja">っ</span> kecil menggandakan konsonan berikutnya: <span lang="ja">きって</span> (kitte). Vokal panjang ditulis dengan menambah vokal:{" "}
            <span lang="ja">おかあさん</span> (okaasan).
          </li>
        </ul>
      </Section>

      <Section title="Tips menghafal">
        <ul className="list-disc space-y-1.5 pl-5 text-sm font-semibold leading-relaxed text-slate-700">
          <li>Hafalkan satu baris (lima huruf) dulu, jangan sekaligus.</li>
          <li>Ucapkan keras-keras sambil melihat tabel, lalu tutup tabelnya dan coba ingat.</li>
          <li>Tulis setiap huruf beberapa kali dengan tangan.</li>
          <li>Kerjakan pelajaran Hiragana di Beranda dan ulangi kartunya di Flashcard. Tabel ini bisa dibuka lagi dari Kamus.</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpen("hiragana")}
            className="inline-flex items-center gap-2 rounded-2xl bg-secondary-600 px-4 py-2.5 text-sm font-extrabold text-white shadow transition hover:bg-secondary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
          >
            Lihat tabel hiragana
            <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.6} />
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-secondary-700 ring-1 ring-secondary-200 transition hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
          >
            Mulai belajar
          </Link>
        </div>
      </Section>
    </>
  );
}

// ---- Tabel ---------------------------------------------------------------------------------------------------------------

function ChartView({ chart, script }: { chart: readonly KanaSection[]; script: "hiragana" | "katakana" }) {
  const k = script === "hiragana" ? { wo: "を", n: "ん", dji: "ぢ", dzu: "づ", ji: "じ", zu: "ず" } : { wo: "ヲ", n: "ン", dji: "ヂ", dzu: "ヅ", ji: "ジ", zu: "ズ" };
  return (
    <>
      {script === "katakana" && (
        <Card tone="emerald" padding="sm">
          <p className="text-sm font-bold text-emerald-900">
            Bunyi katakana sama persis dengan hiragana. Bunyi panjang ditulis dengan garis ー, misalnya <span lang="ja">コーヒー</span> (koohii, kopi). Unit
            Katakana belum tersedia di jalur belajar; pakai tabel ini untuk mengenali bentuknya dulu.
          </p>
        </Card>
      )}
      {chart.map((section) => (
        <KanaTable key={section.id} section={section} />
      ))}
      <Card padding="md" className="space-y-2" data-testid="kana-legend">
        <p className="flex items-center gap-2 text-sm font-black text-slate-900">
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded bg-amber-100 ring-2 ring-amber-400" />
          Kotak kuning: bunyinya tidak mengikuti pola baris
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">
          <li>
            <span lang="ja">{k.wo}</span> ditulis wo tetapi dibaca o, dan hampir selalu dipakai sebagai partikel.
          </li>
          <li>
            <span lang="ja">{k.n}</span> (n) adalah satu-satunya huruf tanpa vokal.
          </li>
          <li>
            <span lang="ja">{k.dji}</span> dan <span lang="ja">{k.ji}</span> sama-sama dibaca ji; <span lang="ja">{k.dzu}</span> dan{" "}
            <span lang="ja">{k.zu}</span> sama-sama zu. <span lang="ja">{k.dji}</span>/<span lang="ja">{k.dzu}</span> jarang dipakai.
          </li>
        </ul>
      </Card>
    </>
  );
}

function KanaTable({ section }: { section: KanaSection }) {
  return (
    <Card padding="md" className="space-y-3" data-testid={`kana-section-${section.id}`}>
      <div>
        <h2 className="text-lg font-black text-slate-900">{section.title}</h2>
        <p className="text-sm font-semibold text-slate-600">{section.description}</p>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center sm:border-spacing-1.5">
        <caption className="sr-only">{section.title}</caption>
        <thead>
          <tr>
            <td className="w-10 sm:w-14" />
            {section.columns.map((column) => (
              <th key={column} scope="col" className="pb-1 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, rowIndex) => (
            <tr key={`${row.label}-${rowIndex}`}>
              <th scope="row" className="text-xs font-extrabold text-slate-600 sm:text-sm">
                {row.label}
              </th>
              {row.cells.map((cell, i) =>
                cell ? (
                  <td
                    key={i}
                    data-testid="kana-cell"
                    className={`rounded-xl px-0.5 py-1.5 ring-1 sm:py-2 ${cell.irregular ? "bg-amber-100 ring-2 ring-amber-400" : "bg-white ring-secondary-100"}`}
                  >
                    <span lang="ja" className="block whitespace-nowrap text-xl font-black leading-tight text-slate-900 sm:text-3xl">
                      {cell.kana}
                    </span>
                    <span className="block text-xs font-bold text-slate-600 sm:text-sm">{cell.romaji}</span>
                    {cell.irregular && <span className="sr-only">(tidak mengikuti pola baris)</span>}
                  </td>
                ) : (
                  <td key={i} aria-hidden="true" />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
