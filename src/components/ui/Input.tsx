import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: string;
};

export function Input({ className, label, icon, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{label}</span>
      <span className="relative block">
        {icon ? (
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-secondary" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors placeholder:text-secondary focus:border-primary",
            icon && "pl-11",
            className
          )}
          {...props}
        />
      </span>
    </label>
  );
}
