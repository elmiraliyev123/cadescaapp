import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary border-primary hover:opacity-90",
  secondary: "bg-surface-container-lowest text-primary border-outline-variant/80 hover:bg-surface-container-low",
  ghost: "bg-transparent text-primary border-transparent hover:bg-surface-container-low",
  quiet: "bg-surface-container-low text-primary border-outline-variant/80 hover:bg-surface-container"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-caption",
  md: "h-11 px-4 text-label-md",
  lg: "h-12 px-5 text-label-md"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        sizes[size],
        variants[variant],
        className
      )}
      {...props}
    >
      {icon ? <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}
