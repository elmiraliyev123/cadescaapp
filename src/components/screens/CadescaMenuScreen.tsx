import type { Merchant } from "@/lib/types";
import { MenuCard } from "@/components/cards/MenuCard";
import { Badge } from "@/components/ui/Badge";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { useLanguage } from "@/lib/i18n";

export function CadescaMenuScreen({ merchants, onRedeem, cmuBalance }: { merchants: Merchant[]; onRedeem: (merchantId: string, mealName: string) => void; cmuBalance: number }) {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader
        title={t("common.cadescaMenu")}
        description={t("employee.partnerRestaurantsOffering")}
        action={<Badge tone="inverse">1 CMU meals</Badge>}
      />
      <div className="grid items-stretch gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {merchants.map((merchant) => (
          <MenuCard key={merchant.id} merchant={merchant} onRedeem={onRedeem} cmuBalance={cmuBalance} />
        ))}
      </div>
    </section>
  );
}
