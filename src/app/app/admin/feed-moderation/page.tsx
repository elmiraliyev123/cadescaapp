import { redirect } from "next/navigation";

import {
  setPostModerationStatusAction,
  setReportModerationStatusAction
} from "@/app/app/admin/feed-moderation/actions";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdminSession } from "@/lib/server/adminAuth";
import { listAdminModerationPosts, listAdminPostReports } from "@/lib/server/social";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "active" || status === "resolved") return "success";
  if (status === "open" || status === "hidden") return "warning";
  return "muted";
}

function ModerationButton({
  postId,
  status,
  icon,
  children
}: {
  postId: string;
  status: "active" | "hidden" | "deleted";
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <form action={setPostModerationStatusAction}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant="secondary" icon={icon}>
        {children}
      </Button>
    </form>
  );
}

function ReportButton({
  reportId,
  status,
  icon,
  children
}: {
  reportId: string;
  status: "resolved" | "dismissed";
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <form action={setReportModerationStatusAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant="secondary" icon={icon}>
        {children}
      </Button>
    </form>
  );
}

async function requireAdminOrRedirect() {
  try {
    return await requireAdminSession();
  } catch {
    redirect("/admin/login");
  }
}

export default async function AdminFeedModerationRoute() {
  await requireAdminOrRedirect();

  try {
    const [posts, reports] = await Promise.all([
      listAdminModerationPosts(),
      listAdminPostReports()
    ]);

    const openReports = reports.filter((report) => report.status === "open").length;
    const hiddenPosts = posts.filter((post) => post.status === "hidden").length;

    return (
      <section>
        <ScreenHeader
          title="Feed Moderation"
          description="University social posts and reports."
          action={<Badge tone="inverse">{openReports} open reports</Badge>}
        />

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">Posts</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{posts.length}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">Hidden</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{hiddenPosts}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-caption font-semibold uppercase text-secondary">Reports</p>
            <p className="mt-2 text-headline-md font-semibold text-primary">{reports.length}</p>
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-headline-md font-semibold text-primary">Posts</h2>
              <Badge tone="muted">{posts.length} total</Badge>
            </div>
            {posts.length ? (
              <DataTable
                rows={posts}
                getRowKey={(row) => row.id}
                columns={[
                  {
                    header: "Post",
                    cell: (row) => (
                      <div className="max-w-[360px] whitespace-normal">
                        <p className="text-label-md text-primary">{row.body}</p>
                        <p className="mt-1 text-caption text-secondary">{formatDateTime(row.createdAt)}</p>
                      </div>
                    )
                  },
                  { header: "Author", cell: (row) => <span>{row.authorName}</span> },
                  { header: "University", cell: (row) => row.universityName },
                  { header: "Status", cell: (row) => <Badge tone={statusTone(row.status) as any}>{row.status}</Badge> },
                  {
                    header: "Signals",
                    cell: (row) => (
                      <span>
                        {row.likeCount} likes / {row.commentCount} comments / {row.openReportCount} open
                      </span>
                    )
                  },
                  {
                    header: "Actions",
                    cell: (row) => (
                      <div className="flex flex-wrap gap-2">
                        {row.status !== "active" ? (
                          <ModerationButton postId={row.id} status="active" icon="undo">Restore</ModerationButton>
                        ) : (
                          <ModerationButton postId={row.id} status="hidden" icon="visibility_off">Hide</ModerationButton>
                        )}
                        {row.status !== "deleted" ? (
                          <ModerationButton postId={row.id} status="deleted" icon="delete">Delete</ModerationButton>
                        ) : null}
                      </div>
                    )
                  }
                ]}
              />
            ) : (
              <EmptyState icon="forum" text="No posts yet." />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-headline-md font-semibold text-primary">Reports</h2>
              <Badge tone={openReports ? "warning" : "muted"}>{openReports} open</Badge>
            </div>
            {reports.length ? (
              <DataTable
                rows={reports}
                getRowKey={(row) => row.id}
                columns={[
                  {
                    header: "Report",
                    cell: (row) => (
                      <div className="max-w-[360px] whitespace-normal">
                        <p className="text-label-md font-semibold text-primary">{row.reason}</p>
                        <p className="mt-1 text-caption text-secondary">{row.postPreview}</p>
                      </div>
                    )
                  },
                  { header: "Reporter", cell: (row) => row.reporterEmail },
                  { header: "University", cell: (row) => row.universityName },
                  { header: "Status", cell: (row) => <Badge tone={statusTone(row.status) as any}>{row.status}</Badge> },
                  { header: "Time", cell: (row) => formatDateTime(row.createdAt) },
                  {
                    header: "Actions",
                    cell: (row) => (
                      row.status === "open" ? (
                        <div className="flex flex-wrap gap-2">
                          <ReportButton reportId={row.id} status="resolved" icon="check_circle">Resolve</ReportButton>
                          <ReportButton reportId={row.id} status="dismissed" icon="block">Dismiss</ReportButton>
                        </div>
                      ) : (
                        <span className="text-secondary">Closed</span>
                      )
                    )
                  }
                ]}
              />
            ) : (
              <EmptyState icon="flag" text="No reports yet." />
            )}
          </section>
        </div>
      </section>
    );
  } catch (error) {
    console.error("[admin_feed_moderation] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });

    return (
      <section>
        <ScreenHeader title="Feed Moderation" description="University social posts and reports." />
        <div className="premium-card p-6 text-center">
          <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">sync_problem</span>
          <h2 className="mt-3 text-headline-md font-semibold text-primary">Moderation unavailable</h2>
          <p className="mt-2 text-body-md text-secondary">Apply the university social migration and check the database connection.</p>
        </div>
      </section>
    );
  }
}
