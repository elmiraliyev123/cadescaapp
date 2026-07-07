import type { Merchant } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n";

export function MenuCard({ merchant, onRedeem, cmuBalance }: { merchant: Merchant; onRedeem: (merchantId: string, mealName: string) => void; cmuBalance: number }) {
  const { t } = useLanguage();
  const disabled = cmuBalance < 1;

  return (
    <article className="premium-card flex min-h-full flex-col p-4 transition-colors hover:border-primary">
      <div className="mb-4 flex h-28 items-center justify-between rounded-lg border border-outline-variant/70 bg-surface-container-low px-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">{t("employee.partnerRestaurant")}</p>
          <p className="mt-2 text-label-md font-semibold text-primary">{merchant.availability === "Cadesca Menu available" ? t("employee.cadescaMenuAvailable") : merchant.availability}</p>
        </div>
        <span className="material-symbols-outlined text-[34px] text-secondary" aria-hidden="true">storefront</span>
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-headline-md font-semibold text-primary">{merchant.name}</h3>
          <p className="mt-1 text-caption font-medium text-secondary">{merchant.location}</p>
        </div>
        <Badge tone={merchant.status === "Available" ? "default" : "warning"}>{t(`common.${merchant.status.toLowerCase()}` as any)}</Badge>
      </div>
      <div className="mt-4 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
        <div className="flex items-center justify-between">
          <span className="text-label-md font-semibold text-primary">{t("common.cadescaMenu")}</span>
          <Badge tone="inverse">1 CMU</Badge>
        </div>
        <p className="mt-2 text-caption font-medium text-secondary">1 CMU meals with optional AZN add-ons.</p>
      </div>
      <div className="mt-4 flex-1 space-y-3">
        {merchant.meals.map((meal) => (
          <div key={meal.name} className="border-b border-outline-variant/70 pb-3 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label-md font-semibold text-primary">{meal.name}</p>
                <p className="mt-1 text-caption font-medium text-secondary">{meal.description}</p>
              </div>
              <Badge>{meal.price}</Badge>
            </div>
            <div>
              <Button size="sm" variant="secondary" className="mt-3 w-full justify-center" icon="qr_code_scanner" onClick={() => onRedeem(merchant.id, meal.name)} disabled={disabled}>
                {t("employee.redeemThisMeal")}
              </Button>
              {disabled && <p className="mt-1 text-center text-caption font-medium text-secondary">{t("employee.noCmuAvailable")}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {merchant.extras.map((extra) => (
          <div key={extra.name} className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 py-2">
            <p className="text-caption font-semibold text-primary">
              {extra.name === "Extra Coffee" ? t("employee.extraCoffee") : extra.name === "Extra Dessert" ? t("employee.extraDessert") : extra.name}
            </p>
            <p className="text-caption font-medium text-secondary">{extra.price}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
