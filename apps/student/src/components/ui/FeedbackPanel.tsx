import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./icons";

export interface FeedbackPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  correct: boolean;
  /** Penjelasan di bawah "Benar!"/"Kurang tepat" (jawaban yang benar, catatan koreksi, dst). */
  detail?: ReactNode;
  nextLabel: string;
  onNext: () => void;
}

/** Panel umpan balik sesudah menjawab soal (pelajaran dan percakapan): hijau bila benar, merah bila salah, dengan tombol lanjut.
 * Atribut `data-*` dari pemanggil diteruskan ke elemen akarnya; tombolnya berpenanda `data-testid="next-button"`. */
export function FeedbackPanel({ correct, detail, nextLabel, onNext, className, ...rest }: FeedbackPanelProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border-2 p-4 motion-safe:animate-pop-in sm:flex-row sm:items-center ${
        correct ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
      } ${className ?? ""}`}
      {...rest}
    >
      <div className="flex flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-white ${correct ? "bg-emerald-600" : "bg-rose-600"}`}
        >
          <Icon name={correct ? "check" : "x"} className="h-7 w-7" strokeWidth={3.2} />
        </span>
        <div className="min-w-0">
          <p role="status" className="text-lg font-black">
            {correct ? "Benar!" : "Kurang tepat"}
          </p>
          {detail && <p className="text-sm font-bold">{detail}</p>}
        </div>
      </div>
      <Button data-testid="next-button" variant={correct ? "success" : "danger"} size="lg" onClick={onNext} className="sm:min-w-32">
        {nextLabel}
      </Button>
    </div>
  );
}
