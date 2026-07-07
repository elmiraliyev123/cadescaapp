import Link from "next/link";
import type { Transaction } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

export function TransactionList({ transactions, showViewAll, viewAllHref }: { transactions: Transaction[]; showViewAll?: boolean; viewAllHref?: string }) {
  const { t } = useLanguage();
  return (
    <div className="premium-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-label-md font-semibold text-primary">{t("employee.recentActivity")}</h3>
        <span className="text-caption font-medium text-secondary">{transactions.length} items</span>
      </div>
      <div className="divide-y divide-outline-variant/70">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between gap-4 py-4 first:pt-2 last:pb-1">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/70 bg-surface-container-low">
                <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{transaction.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-label-md font-semibold text-primary">{transaction.merchant}</p>
                <p className="truncate text-caption font-medium text-secondary">{transaction.detail} | {transaction.time}</p>
              </div>
            </div>
            <span className="shrink-0 text-[13px] font-semibold leading-5 text-primary">{transaction.amount}</span>
          </div>
        ))}
      </div>
      {showViewAll && viewAllHref && (
        <div className="mt-3 flex justify-center border-t border-outline-variant/70 pt-3">
          <Link href={viewAllHref} className="text-[13px] font-semibold text-primary hover:underline">
            {t("employee.viewAllActivity")} →
          </Link>
        </div>
      )}
    </div>
  );
}
