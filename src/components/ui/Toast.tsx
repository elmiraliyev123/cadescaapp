import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  const { t } = useLanguage();
  const translatedMessage = message.includes(".") ? t(message as any) : message;
  const label = translatedMessage === message ? message : translatedMessage;

  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 z-[90] w-[calc(100%-40px)] max-w-md -translate-x-1/2 rounded-xl border border-primary bg-primary px-4 py-3 text-on-primary transition-all md:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined icon-ui" aria-hidden="true">info</span>
        <span className="text-label-md font-semibold">{label}</span>
      </div>
    </div>
  );
}
