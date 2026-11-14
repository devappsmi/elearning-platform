import { langOf } from "../lib/lang";

/**
 * Soal: satu-dua karakter (mis. sebuah huruf kana) tampil sebagai lambang besar di ubin berwarna; selebihnya teks tebal.
 * Dua karakter bisa satu suku kata (きゃ = kya) atau satu kata (学生), jadi ubinnya melebar mengikuti isi dan tidak boleh
 * patah baris. Dulu ubin selebar tetap 128 px mematahkan きゃ menjadi き di atas ゃ, yang terbaca "ki-ya".
 */
export function ExercisePrompt({ text, sub, small }: { text: string; sub?: string | null; small?: boolean }) {
  const length = Array.from(text).length;
  const glyph = !small && length <= 2;
  return (
    <div className="space-y-2 text-center">
      <p
        lang={langOf(text)}
        data-testid="exercise-prompt"
        className={
          glyph
            ? `mx-auto grid h-32 w-fit min-w-32 place-items-center whitespace-nowrap rounded-[2rem] bg-gradient-to-br from-secondary-100 via-tertiary-100 to-pink-100 px-6 font-black text-secondary-800 shadow-inner ring-1 ring-secondary-200 ${length > 1 ? "text-6xl" : "text-7xl"}`
            : `text-balance font-black leading-snug text-slate-900 [word-break:auto-phrase] ${small ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"}`
        }
      >
        {text}
      </p>
      {sub && (
        <p lang={langOf(sub)} className="text-balance text-base font-bold text-slate-600 [word-break:auto-phrase]">
          {sub}
        </p>
      )}
    </div>
  );
}
