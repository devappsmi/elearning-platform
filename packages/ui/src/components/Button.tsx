import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:outline-gray-400",
};

/**
 * Minimal starter primitive for `packages/ui`. Real design polish (sizes,
 * loading state, icons, etc.) is Fase 1 — this pass just needs a styled,
 * reusable button so the package isn't empty and both apps have something
 * to build on.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, ...props },
  ref,
) {
  const classes = [
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
    "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    variantClasses[variant],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button ref={ref} className={classes} {...props} />;
});

Button.displayName = "Button";
