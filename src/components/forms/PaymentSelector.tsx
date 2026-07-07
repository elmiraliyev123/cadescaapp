import type { PaymentType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

const getOptions = (t: any): Array<{ id: PaymentType; label: string; detail: string; icon: string }> => [
  { id: "cmu", label: t("merchant.redeem1CMU"), detail: "Standard partner meal", icon: "restaurant" },
  { id: "azn", label: t("merchant.payWithAznWallet"), detail: "Regular wallet payment", icon: "account_balance_wallet" },
  { id: "split", label: t("merchant.cmuAznSplitPayment"), detail: "Meal plus extra items", icon: "call_split" }
];

export function PaymentOption({
  selected,
  label,
  detail,
  icon,
  onSelect
}: {
  selected: boolean;
  label: string;
  detail: string;
  icon: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant/70 bg-surface-container-lowest text-primary hover:bg-surface-container-low"
      )}
    >
      <span className="material-symbols-outlined text-[21px]" aria-hidden="true">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-5">{label}</span>
        <span className={cn("block text-caption font-medium", selected ? "text-inverse-primary" : "text-secondary")}>{detail}</span>
      </span>
    </button>
  );
}

export function PaymentSelector({ value, onChange }: { value: PaymentType; onChange: (value: PaymentType) => void }) {
  const { t } = useLanguage();
  const options = getOptions(t);
  return (
    <div className="grid gap-3">
      {options.map((option) => (
        <PaymentOption
          key={option.id}
          selected={value === option.id}
          label={option.label}
          detail={option.detail}
          icon={option.icon}
          onSelect={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}
