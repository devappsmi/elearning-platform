import type { ReactNode } from "react";
import { langOf } from "../../lib/lang";

/** Isi catatan tata bahasa (`GrammarNote.bodyMd`) -> tampilan. Mendukung subset kecil Markdown yang dipakai konten:
 *  - paragraf (dipisah baris kosong; baris di dalamnya disambung dengan jeda baris)
 *  - "Judul:" sendirian di baris pertama blok yang diikuti daftar -> judul kecil
 *  - daftar "- butir"; baris sesudahnya yang berindentasi (dua spasi) menempel ke butir itu sebagai baris kedua (mis. artinya)
 *  - **tebal**
 * Selain itu teks biasa. Teks sumber tidak pernah dianggap HTML (React meloloskan semuanya). Sengaja BUKAN pustaka Markdown:
 * kontennya cuma memakai bentuk di atas, dan dependensi baru tidak sebanding. */

interface Item {
  lines: string[];
}

type Block = { kind: "paragraph"; lines: string[] } | { kind: "list"; label?: string; items: Item[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.trim().split(/\n{2,}/)) {
    const lines = chunk.split("\n");
    const firstItem = lines.findIndex((line) => line.startsWith("- "));
    if (firstItem === -1) {
      blocks.push({ kind: "paragraph", lines });
      continue;
    }
    const label = firstItem === 1 && (lines[0] ?? "").endsWith(":") ? (lines[0] as string).slice(0, -1) : undefined;
    // Baris sebelum butir pertama yang bukan judul tetap tampil sebagai paragraf.
    if (firstItem > 0 && label === undefined) blocks.push({ kind: "paragraph", lines: lines.slice(0, firstItem) });
    const items: Item[] = [];
    for (const line of lines.slice(firstItem)) {
      if (line.startsWith("- ")) items.push({ lines: [line.slice(2)] });
      else if (items.length > 0) (items[items.length - 1] as Item).lines.push(line.trim());
    }
    blocks.push({ kind: "list", label, items });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

/** Rangkaian bentuk "A → B → C": tiap bagian tidak terpotong di tengah (baris baru hanya jatuh di panah), kecuali bagian itu sendiri
 *  lebih lebar dari baris. */
function chain(text: string): ReactNode {
  const parts = text.split(" → ");
  if (parts.length < 2) return inline(text);
  return parts.flatMap((part, i) => [
    i > 0 ? " → " : null,
    <span key={i} lang={langOf(part)} className="inline-block max-w-full [overflow-wrap:anywhere]">
      {inline(part)}
    </span>,
  ]);
}

export function NoteBody({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {parseBlocks(text).map((block, index) =>
        block.kind === "paragraph" ? (
          <p key={index} className="text-sm font-semibold leading-relaxed text-slate-700">
            {block.lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {inline(line)}
              </span>
            ))}
          </p>
        ) : (
          <div key={index} className="space-y-1.5">
            {block.label && <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">{block.label}</p>}
            <ul className="space-y-2">
              {block.items.map((item, i) => (
                <li key={i} className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-sky-100">
                  <p lang={langOf(item.lines[0] ?? "")} className="text-base font-extrabold leading-snug text-slate-900 [word-break:auto-phrase]">
                    {chain(item.lines[0] ?? "")}
                  </p>
                  {item.lines.slice(1).map((line, j) => (
                    <p key={j} className="text-sm font-semibold leading-snug text-slate-600">
                      {inline(line)}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
