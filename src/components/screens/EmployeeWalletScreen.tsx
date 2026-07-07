import type { Transaction } from "@/lib/types";
import { BalanceCard } from "@/components/cards/BalanceCard";
import { TransactionList } from "@/components/cards/TransactionList";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logo";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

const qrPattern = new Set([
  0, 1, 2, 4, 5, 6,
  7, 9, 11, 13,
  14, 15, 16, 18, 20,
  22, 24, 25, 27,
  28, 30, 32, 33, 34,
  35, 37, 39, 41,
  42, 43, 44, 46, 48
]);

export function EmployeeWalletScreen({
  cmu,
  azn,
  todayMeal,
  transactions,
  onRedeem,
  onPayAzn,
  onSplit,
  onNavigateMenu,
  onNavigateTravel
}: {
  cmu: number;
  azn: string;
  todayMeal: string;
  transactions: Transaction[];
  onRedeem: () => void;
  onPayAzn: () => void;
  onSplit: () => void;
  onNavigateMenu: () => void;
  onNavigateTravel: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section>
      <ScreenHeader
        title={t("employee.employeeWallet")}
        description="CMU meal entitlement and AZN wallet balance in one calm operating surface."
        action={<Badge tone="inverse">{t("employee.todayAvailable").replace("Available", todayMeal)}</Badge>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_390px]">
        <div className="space-y-4 md:space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <BalanceCard title={t("employee.cmuBalance")} value={`${cmu} CMU`} subtitle="Standardized meal entitlement" icon="restaurant" badge="Meal units" trend={t("common.available")} />
            <BalanceCard title={t("employee.aznWallet")} value={azn} subtitle="For extras and wallet payments" icon="account_balance_wallet" badge="Azerbaijan" trend={t("common.active")} />
          </div>
          <div className="premium-card p-4 md:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="flex min-h-[318px] flex-col justify-between rounded-xl bg-primary p-5 text-on-primary md:min-h-[332px] md:p-6">
                <div className="flex items-center justify-between gap-4">
                  <Logo className="invert" />
                  <Badge tone="inverse" className="border-on-primary bg-on-primary text-primary">Wallet ready</Badge>
                </div>
                <div className="flex flex-1 items-center justify-center py-6 md:py-8">
                  <div className="grid h-44 w-44 place-items-center rounded-xl border border-on-primary/20 bg-on-primary text-primary md:h-48 md:w-48">
                    <div className="grid h-32 w-32 grid-cols-7 gap-1.5 md:h-[136px] md:w-[136px]" aria-hidden="true">
                      {Array.from({ length: 49 }).map((_, index) => (
                        <span key={index} className={cn("rounded-[2px]", qrPattern.has(index) ? "bg-primary" : "bg-transparent")} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-4 overflow-visible">
                  <div className="min-w-0 shrink-0">
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-inverse-primary">Payment code</p>
                  <p className="mt-2 text-headline-md font-semibold text-on-primary">CMU-AZN-8421</p>
                  </div>
                  <p className="hidden text-right text-caption font-medium text-inverse-primary sm:block">Scan at partner restaurants</p>
                </div>
              </div>
              <div className="grid content-between gap-3">
                <div className="premium-card-muted p-4">
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Today's meal status</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-headline-md font-semibold text-primary">{todayMeal}</p>
                    <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">check_circle</span>
                  </div>
                </div>
                <div>
                  <Button size="lg" className="w-full" icon="restaurant" onClick={onRedeem} disabled={cmu === 0}>
                    {t("employee.use1CMU")}
                  </Button>
                  {cmu === 0 && <p className="mt-1 text-center text-caption font-medium text-secondary">{t("employee.noCmuAvailable")}</p>}
                </div>
                <Button size="lg" variant="secondary" className="w-full" icon="payments" onClick={onPayAzn}>
                  {t("employee.payWithAZN")}
                </Button>
                <Button size="lg" variant="secondary" className="w-full" icon="call_split" onClick={onSplit} disabled={cmu === 0}>
                  {t("employee.cmuAznSplit")}
                </Button>
                <div className="rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4">
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Demo balance</p>
                  <p className="mt-2 text-label-md font-semibold text-primary">{cmu} CMU and {azn}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={onNavigateTravel}
              className="premium-card p-5 text-left transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[26px] text-primary" aria-hidden="true">flight_takeoff</span>
              <p className="mt-6 text-label-md font-semibold text-primary">Travel Mode shortcut</p>
              <p className="mt-1 text-caption font-medium text-secondary">Preview CMU value abroad.</p>
            </button>
            <button
              type="button"
              onClick={onNavigateMenu}
              className="premium-card p-5 text-left transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[26px] text-primary" aria-hidden="true">room_service</span>
              <p className="mt-6 text-label-md font-semibold text-primary">Cadesca Menu shortcut</p>
              <p className="mt-1 text-caption font-medium text-secondary">See partner meals for 1 CMU.</p>
            </button>
          </div>
        </div>
        <TransactionList transactions={transactions} showViewAll viewAllHref="/app/employee/activity" />
      </div>
    </section>
  );
}
