import type { Employee, Merchant } from "@/lib/types";
import { StatCard } from "@/components/cards/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { useLanguage } from "@/lib/i18n";

export function EmployerDashboardScreen({
  employees,
  merchants,
  cmuUsed = 286,
  aznUsed = 1240,
  activeEmployees,
  monthlyBudget = 4850,
  activeMerchants,
  topMerchants,
  usageBars,
  onAddEmployee,
  onTopUpBalance,
  onTravelPolicy,
  onDownloadReport
}: {
  employees: Employee[];
  merchants: Merchant[];
  cmuUsed?: number;
  aznUsed?: number;
  activeEmployees?: number;
  monthlyBudget?: number;
  activeMerchants?: number;
  topMerchants?: Array<{ merchantName: string; cmu: number; azn: number; transactions: number }>;
  usageBars?: Array<{ label: string; cmu: number; azn: number }>;
  onAddEmployee?: () => void;
  onTopUpBalance?: () => void;
  onTravelPolicy?: () => void;
  onDownloadReport?: () => void;
}) {
  const { t } = useLanguage();
  const usage = usageBars?.length ? usageBars : [{ label: "Live", cmu: 8, azn: 8 }];

  return (
    <section>
      <ScreenHeader
        title={t("employer.employerDashboard")}
        description={t("employer.hrAndFinance")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="person_add" onClick={onAddEmployee}>{t("employer.addEmployee")}</Button>
            <Button variant="secondary" icon="add_card" onClick={onTopUpBalance}>{t("employer.topUpBalance")}</Button>
            <Button variant="secondary" icon="flight_takeoff" onClick={onTravelPolicy}>{t("employer.travelPolicyTitle")}</Button>
            <Button icon="download" onClick={onDownloadReport}>{t("employer.downloadReport")}</Button>
          </div>
        }
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t("employer.totalMealBudget")} value={`${monthlyBudget.toLocaleString("en-US")} AZN`} detail="Current monthly allocation" icon="account_balance" />
        <StatCard label={t("employer.activeEmployees")} value={`${activeEmployees ?? employees.length}`} detail="Northstar Labs" icon="groups" />
        <StatCard label={t("employer.cmuUsage")} value={`${cmuUsed}`} detail="Used this month" icon="restaurant" />
        <StatCard label={t("employer.aznUsage")} value={`${aznUsed.toLocaleString("en-US", { maximumFractionDigits: 0 })} AZN`} detail="Wallet payments" icon="payments" />
        <StatCard label={t("employer.activeMerchants")} value={`${activeMerchants ?? merchants.length}`} detail="Baku network" icon="storefront" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="premium-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-headline-md font-semibold text-primary">{t("employer.employeeBalances")}</h2>
            <Badge>Live demo data</Badge>
          </div>
          <DataTable
            rows={employees}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Employee", cell: (row) => row.name },
              { header: "Department", cell: (row) => row.department },
              { header: "CMU", cell: (row) => `${row.cmu} CMU` },
              { header: "AZN Wallet", cell: (row) => row.azn },
              { header: "Status", cell: (row) => <Badge tone={row.status.toLowerCase() === "active" ? "default" : "warning"}>{t(`common.${row.status.toLowerCase()}` as any)}</Badge> }
            ]}
          />
        </div>
        <div className="space-y-5">
          <div className="premium-card p-5">
            <h2 className="text-headline-md font-semibold text-primary">Usage bars</h2>
            <div className="mt-6 flex h-40 items-end gap-3 border-b border-outline-variant/70 px-2 pb-2">
              {usage.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full items-end gap-1">
                    <div className="flex-1 rounded-t bg-primary" style={{ height: `${item.cmu}%` }} />
                    <div className="flex-1 rounded-t bg-surface-variant" style={{ height: `${item.azn}%` }} />
                  </div>
                  <span className="text-caption font-semibold text-secondary">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-caption font-medium text-secondary">CMU usage</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-surface-variant" />
                <span className="text-caption font-medium text-secondary">AZN usage</span>
              </div>
            </div>
          </div>
          <div className="premium-card p-5">
            <h2 className="text-headline-md font-semibold text-primary">Top merchants</h2>
            <div className="mt-4 divide-y divide-outline-variant/70">
              {(topMerchants?.length ? topMerchants : merchants.slice(0, 4).map((merchant) => ({ merchantName: merchant.name, cmu: 0, azn: 0, transactions: 0 }))).map((merchant) => (
                <div key={merchant.merchantName} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-label-md font-semibold text-primary">{merchant.merchantName}</p>
                    <p className="text-caption font-medium text-secondary">{merchant.transactions} transactions</p>
                  </div>
                  <span className="text-label-md font-semibold text-primary">{merchant.cmu} CMU</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-primary bg-primary p-5 text-on-primary">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-inverse-primary">Travel policy settings</p>
            <p className="mt-4 text-headline-md font-semibold">Borderless meal benefit</p>
            <p className="mt-2 text-body-md text-inverse-primary">Employees can use CMU in Azerbaijan, Italy, Spain and Turkey during approved business travel.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
