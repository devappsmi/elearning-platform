import type { GrammarNote } from "@elearning/domain";
import { Card } from "./ui/Card";
import { Icon } from "./ui/icons";
import { NoteBody } from "./ui/NoteBody";

/** Catatan tata bahasa pelajaran (unit memberi `lessonId` pada catatannya): tombol "Catatan" di bilah atas halaman belajar dan
 *  panel yang terbuka di bawahnya. Keduanya dipisah karena letaknya berbeda; keadaan buka/tutup dipegang halaman. */

export const LESSON_NOTES_ID = "lesson-notes";

export function NotesToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={LESSON_NOTES_ID}
      onClick={onToggle}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300 ${
        open
          ? "border-secondary-600 bg-secondary-700 text-white"
          : "border-secondary-200 bg-white text-secondary-800 hover:border-secondary-300 hover:bg-secondary-50"
      }`}
    >
      <Icon name="book" className="h-5 w-5" strokeWidth={2.4} />
      <span className="max-[359px]:sr-only">Catatan</span>
    </button>
  );
}

export function NotesPanel({ notes }: { notes: readonly GrammarNote[] }) {
  return (
    // Panel bisa panjang (rangkaian bentuk + contoh): ia menggulir sendiri dan bisa difokus keyboard supaya terjangkau.
    <Card
      as="section"
      tone="sky"
      padding="sm"
      id={LESSON_NOTES_ID}
      aria-label="Catatan tata bahasa"
      tabIndex={0}
      className="max-h-[55vh] space-y-4 overflow-y-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-secondary-300"
    >
      {notes.map((note) => (
        <div key={note.id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <span aria-hidden="true">📝</span>
            {note.title}
          </h2>
          <NoteBody text={note.bodyMd} />
        </div>
      ))}
    </Card>
  );
}
