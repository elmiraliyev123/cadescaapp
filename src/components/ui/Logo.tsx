import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
  maxWidth,
  imgClassName
}: {
  compact?: boolean;
  className?: string;
  priority?: boolean;
  maxWidth?: number;
  imgClassName?: string;
}) {
  if (compact) {
    return (
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center", className)}>
        <img
          src="/cadesca-mark.png"
          alt="Cadesca"
          width={560}
          height={560}
          className={cn("h-8 w-8 object-contain max-w-full", imgClassName)}
          style={{
            width: 32,
            maxWidth: "100%",
            height: "auto",
            objectFit: "contain"
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src="/cadesca-logo.png"
        alt="Cadesca"
        width={1290}
        height={520}
        className={cn(
          "block h-auto object-contain max-w-full",
          imgClassName || (maxWidth ? "w-auto" : "w-[116px] md:w-[126px]")
        )}
        style={{
          width: maxWidth || 180,
          maxWidth: "100%",
          height: "auto",
          objectFit: "contain"
        }}
      />
    </div>
  );
}
