import type { InputHTMLAttributes } from "react";

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
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        readOnly={readOnly}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${readOnly ? "bg-gray-50 text-gray-600" : ""}`}
        {...inputProps}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}
