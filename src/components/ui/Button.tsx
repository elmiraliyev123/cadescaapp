import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-on-primary hover:bg-primary/85",
  secondary: "border-outline-variant/60 bg-surface-container-lowest text-primary hover:bg-surface-container-low",
  ghost: "bg-transparent text-primary border-transparent hover:bg-surface-container-low",
  quiet: "border-transparent bg-surface-container-low text-primary hover:bg-surface-container"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-3 text-[14px] leading-5",
  md: "h-11 px-4 text-[15px] leading-5",
  lg: "h-12 px-5 text-[16px] leading-6"
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-45",
    sizes[size],
    variants[variant],
    className
  );
}

export function StandardButton({
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
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {icon ? <span className="material-symbols-outlined icon-ui" aria-hidden="true">{icon}</span> : null}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

export const Button = StandardButton;

export function ButtonLink({
  href,
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles({ variant, size, className })} {...props}>
      {icon ? <span className="material-symbols-outlined icon-ui" aria-hidden="true">{icon}</span> : null}
      <span className="whitespace-nowrap">{children}</span>
    </Link>
  );
}

export function iconButtonStyles({
  size = "md",
  className
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-45",
    size === "sm" ? "h-10 w-10" : "h-11 w-11",
    className
  );
}

export function IconButton({
  icon,
  label,
  size = "md",
  className,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonStyles({ size, className })}
      {...props}
    >
      <span className="material-symbols-outlined icon-action" aria-hidden="true">{icon}</span>
    </button>
  );
}

export function IconLink({
  href,
  icon,
  label,
  size = "md",
  className,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children"> & {
  href: string;
  icon: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={iconButtonStyles({ size, className })}
      {...props}
    >
      <span className="material-symbols-outlined icon-action" aria-hidden="true">{icon}</span>
    </Link>
  );
}
