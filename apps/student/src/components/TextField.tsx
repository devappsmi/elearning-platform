import type { InputHTMLAttributes } from "react";

/** Gaya bersama kolom isian (input/select): bulat, tepi jelas, cincin ungu saat fokus. */
export const fieldClasses =
  "w-full rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-900 transition placeholder:text-slate-400 hover:border-violet-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-200";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
  id: string;
  label: string;
  hint?: string;
}

/** Label + input + petunjuk, dengan gaya yang sama seperti form Masuk/Profil.
 * `readOnly` dirender sebagai terkunci (latar abu-abu) -- dipakai untuk email
 * pada form undangan (AUTH-02: "terisi otomatis & terkunci"). */
export function TextField({ id, label, hint, readOnly, ...inputProps }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-extrabold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        readOnly={readOnly}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={
          readOnly
            ? "w-full cursor-not-allowed rounded-2xl border-2 border-slate-200 bg-slate-100 px-4 py-3 text-base font-semibold text-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-200"
            : fieldClasses
        }
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs font-semibold text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}
