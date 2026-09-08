import type { InputHTMLAttributes, ReactNode } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

/** Form input on white form surfaces (the only white surfaces in the system). */
export function TextField({ label, error, hint, id, className = "", ...rest }: TextFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={inputId} className="block">
      <span className="button-cap mb-2 block text-black">{label}</span>
      <input id={inputId} className={`text-input ${error ? "border-black" : ""} ${className}`} {...rest} />
      {error ? (
        <span className="caption mt-2 block text-black">{error}</span>
      ) : hint ? (
        <span className="caption mt-2 block text-ink-mute">{hint}</span>
      ) : null}
    </label>
  );
}
