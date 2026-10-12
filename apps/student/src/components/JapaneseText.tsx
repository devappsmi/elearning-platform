import { Fragment } from "react";
import type { RubySegment } from "@elearning/domain";

/**
 * Teks Jepang, dengan furigana (bacaan kana kecil di atas kanji) bila konten memberinya dan murid menyalakannya.
 * `<rp>` adalah tanda kurung cadangan untuk peramban yang tidak mengenal `<ruby>`; peramban modern menyembunyikannya.
 */
export function JapaneseText({
  text,
  furigana,
  showFurigana,
}: {
  text: string;
  furigana?: readonly RubySegment[];
  showFurigana: boolean;
}) {
  if (!showFurigana || !furigana) return <>{text}</>;
  return (
    <>
      {furigana.map((segment, i) =>
        segment.reading ? (
          <ruby key={i}>
            {segment.text}
            <rp>(</rp>
            <rt>{segment.reading}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <Fragment key={i}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
