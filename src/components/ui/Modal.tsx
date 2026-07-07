import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
};

export function Modal({ open, title, description, children, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-end justify-center bg-primary/20 px-0 pb-0 pt-6 md:items-center md:px-8 md:pb-8 md:pt-8" 
      role="dialog" 
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className="relative flex w-full max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-t-2xl border border-outline-variant/70 bg-surface-container-lowest shadow-2xl md:max-w-[560px] md:max-h-[calc(100vh-64px)] md:rounded-xl">
        <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-lowest p-4 md:p-6">
          <div>
            <h2 className="text-headline-md font-semibold text-primary">{title}</h2>
            {description ? <p className="mt-1 text-body-md text-secondary">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant/70 bg-surface-container-lowest text-primary transition-colors hover:bg-surface-container-low"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
        
        <div className="sticky bottom-0 z-10 grid shrink-0 grid-cols-2 gap-3 border-t border-outline-variant/50 bg-surface-container-lowest p-4 pb-[max(16px,env(safe-area-inset-bottom))] md:p-6">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm ?? onClose}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
