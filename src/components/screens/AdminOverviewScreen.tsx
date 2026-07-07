"use client";

import {
  getConfirmedStudentCheckInsToday,
  getPendingMerchantApprovals,
  getVerifiedStudentUsers,
  useDemoState
} from "@/lib/demoStore";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/cards/StatCard";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { useLanguage } from "@/lib/i18n";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function AdminOverviewScreen() {
  const { state } = useDemoState();
  const { t } = useLanguage();
  const pendingApprovals = getPendingMerchantApprovals(state);
  const confirmedStudentCheckInsToday = getConfirmedStudentCheckInsToday(state);
  const verifiedStudents = getVerifiedStudentUsers(state);
  const activeMerchants = (state.merchantUsers || []).filter((merchant) => merchant.status === "active");
  const activityCount = (state.studentCheckIns || []).length + (state.adminAuditLogs || []).length;
  const latestUsers = (state.users || []).filter((user) => user.status !== "deleted").slice(0, 5);
  const latestMerchants = activeMerchants.slice(0, 5);

  return (
    <section>
      <ScreenHeader title={t("admin.adminOverview")} description={t("admin.adminOverviewDescription")} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("common.users")} value={`${(state.users || []).filter((user) => user.status !== "deleted").length}`} detail={`${verifiedStudents.length} ${t("management.studentVerified")}`} icon="people" />
        <StatCard label={t("admin.merchantAccounts")} value={`${activeMerchants.length}`} detail={t("admin.merchantAccountsDescription")} icon="storefront" />
        <StatCard label={t("common.activity")} value={`${activityCount}`} detail={`${confirmedStudentCheckInsToday.length} ${t("common.today")}`} icon="receipt_long" />
        <StatCard label={t("admin.approvals")} value={`${pendingApprovals.length}`} detail={t("admin.approvalsDescription")} icon="fact_check" />
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <StatCard label={t("admin.extensions")} value={`${state.approvedEmailExtensions.filter((extension) => extension.status === "active").length}`} detail={t("admin.universityEmailDomains")} icon="alternate_email" />
        <StatCard label={t("admin.studentCheckIns")} value={`${confirmedStudentCheckInsToday.length}`} detail={t("student.latestConfirmedCheckIn")} icon="fact_check" />
        <StatCard label={t("admin.supportNotes")} value={`${state.supportNotes.length}`} detail={t("admin.supportDescription")} icon="support_agent" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="premium-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-headline-md font-semibold text-primary">{t("common.users")}</h2>
            <Badge>{latestUsers.length}</Badge>
          </div>
          {latestUsers.length ? (
            <DataTable
              rows={latestUsers}
              getRowKey={(row) => row.id}
              columns={[
                { header: t("common.fullName"), cell: (row) => row.name },
                { header: t("common.email"), cell: (row) => row.email },
                { header: t("common.status"), cell: (row) => <Badge tone={row.status === "active" ? "success" : "warning"}>{t(`common.${row.status}` as any)}</Badge> },
                { header: t("common.createdAt"), cell: (row) => formatDate(row.createdAt) }
              ]}
            />
          ) : (
            <p className="text-label-md font-semibold text-secondary">{t("management.noUsersYetSentence")}</p>
          )}
        </div>
        <div className="premium-card p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-headline-md font-semibold text-primary">{t("admin.merchantAccounts")}</h2>
            <Badge>{latestMerchants.length}</Badge>
          </div>
          {latestMerchants.length ? (
            <DataTable
              rows={latestMerchants}
              getRowKey={(row) => row.id}
              columns={[
                { header: t("management.merchantOwnerName"), cell: (row) => row.name },
                { header: t("common.email"), cell: (row) => row.email },
                { header: t("common.status"), cell: (row) => <Badge tone="success">{t("common.active")}</Badge> },
                { header: t("common.createdAt"), cell: (row) => formatDate(row.createdAt) }
              ]}
            />
          ) : (
            <p className="text-label-md font-semibold text-secondary">{t("management.noMerchantAccountsYet")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
