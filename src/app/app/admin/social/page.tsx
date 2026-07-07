import { redirect } from "next/navigation";

import {
  setPostModerationStatusAction,
  setReportModerationStatusAction
} from "@/app/app/admin/feed-moderation/actions";
import {
  approveUniversityAccessRequestAction,
  rejectUniversityAccessRequestAction,
  resetSocialUsernameAction,
  setSocialUserStatusAction,
  upsertUniversityAction
} from "@/app/app/admin/social/actions";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdminSession } from "@/lib/server/adminAuth";
import {
  getAdminSocialOverview,
  listAdminModerationPosts,
  listAdminPostReports,
  listAdminSocialUniversities,
  listAdminSocialUsers
} from "@/lib/server/social";
import { listUniversityAccessRequests } from "@/lib/server/universities";

export const dynamic = "force-dynamic";

type AdminSocialSearchParams = {
  q?: string;
  universityId?: string;
  studentStatus?: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "active" || status === "resolved" || status === "verified") return "success";
  if (status === "open" || status === "hidden" || status === "pending") return "warning";
  return "muted";
}

async function requireAdminOrRedirect() {
  try {
    return await requireAdminSession();
  } catch {
    redirect("/admin/login");
  }
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="premium-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-semibold uppercase text-secondary">{label}</p>
        <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-3 text-headline-md font-semibold text-primary">{value}</p>
    </div>
  );
}

function UserStatusButton({ userId, status }: { userId: string; status: "active" | "suspended" }) {
  const nextStatus = status === "active" ? "suspended" : "active";
  return (
    <form action={setSocialUserStatusAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" size="sm" variant="secondary" icon={nextStatus === "active" ? "person_check" : "block"}>
        {nextStatus === "active" ? "Unsuspend" : "Suspend"}
      </Button>
    </form>
  );
}

function ResetUsernameButton({ userId }: { userId: string }) {
  return (
    <form action={resetSocialUsernameAction}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant="secondary" icon="alternate_email">
        Reset @
      </Button>
    </form>
  );
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

function AccessRequestButton({
  requestId,
  action,
  icon,
  children
}: {
  requestId: string;
  action: (formData: FormData) => Promise<void>;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="requestId" value={requestId} />
      <Button type="submit" size="sm" variant="secondary" icon={icon}>
        {children}
      </Button>
    </form>
  );
}

export default async function AdminSocialRoute({
  searchParams
}: {
  searchParams: Promise<AdminSocialSearchParams>;
}) {
  await requireAdminOrRedirect();
  const filters = await searchParams;

  try {
    const [overview, universities, users, posts, reports, accessRequests] = await Promise.all([
      getAdminSocialOverview(),
      listAdminSocialUniversities(),
      listAdminSocialUsers({
        query: filters.q,
        universityId: filters.universityId,
        studentStatus: filters.studentStatus,
        limit: 60
      }),
      listAdminModerationPosts(50),
      listAdminPostReports(50),
      listUniversityAccessRequests("pending")
    ]);

    const openReports = reports.filter((report) => report.status === "open").length;

    return (
      <section>
        <ScreenHeader
          title="Social"
          description="Operate Cadesca university communities, users, posts, reports and universities."
          action={<Badge tone={openReports ? "warning" : "muted"}>{openReports} open reports</Badge>}
        />

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Total users" value={overview.totalUsers} icon="groups" />
          <MetricCard label="Verified" value={overview.verifiedUsers} icon="verified" />
          <MetricCard label="Total posts" value={overview.totalPosts} icon="forum" />
          <MetricCard label="Pending reports" value={overview.pendingReports} icon="flag" />
          <MetricCard label="Universities" value={overview.activeUniversities} icon="school" />
        </div>

        <div className="space-y-8">
          <section>
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-headline-md font-semibold text-primary">Users</h2>
                <p className="mt-1 text-body-sm text-secondary">Search by name, email or username. Filter by university and verification.</p>
              </div>
              <form className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_180px_160px_auto]">
                <input
                  name="q"
                  defaultValue={filters.q || ""}
                  placeholder="Search users"
                  className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary"
                />
                <select
                  name="universityId"
                  defaultValue={filters.universityId || ""}
                  className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary"
                >
                  <option value="">All universities</option>
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>{university.name}</option>
                  ))}
                </select>
                <select
                  name="studentStatus"
                  defaultValue={filters.studentStatus || ""}
                  className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary"
                >
                  <option value="">All status</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="not_verified">Not verified</option>
                  <option value="rejected">Rejected</option>
                </select>
                <Button type="submit" size="sm" icon="search">Filter</Button>
              </form>
            </div>

            {users.length ? (
              <DataTable
                rows={users}
                getRowKey={(row) => row.id}
                columns={[
                  {
                    header: "User",
                    cell: (row) => (
                      <div className="max-w-[260px] whitespace-normal">
                        <p className="text-label-md font-semibold text-primary">{row.displayName}</p>
                        <p className="mt-1 text-caption text-secondary">{row.username ? `@${row.username}` : "No username"} / {row.email}</p>
                      </div>
                    )
                  },
                  { header: "University", cell: (row) => row.universityName || "Not assigned" },
                  { header: "Verification", cell: (row) => <Badge tone={statusTone(row.studentStatus) as any}>{row.studentStatus}</Badge> },
                  { header: "Status", cell: (row) => <Badge tone={statusTone(row.status) as any}>{row.status}</Badge> },
                  { header: "Signals", cell: (row) => `${row.postsCount} posts / ${row.reportsCount} reports` },
                  {
                    header: "Actions",
                    cell: (row) => (
                      <div className="flex flex-wrap gap-2">
                        <UserStatusButton userId={row.id} status={row.status === "suspended" ? "suspended" : "active"} />
                        <ResetUsernameButton userId={row.id} />
                      </div>
                    )
                  }
                ]}
              />
            ) : (
              <EmptyState icon="groups" text="No users match the current filters." />
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-headline-md font-semibold text-primary">Posts</h2>
                <p className="mt-1 text-body-sm text-secondary">Moderate recent university posts.</p>
              </div>
              <Badge tone="muted">{posts.length} recent</Badge>
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
                  {
                    header: "Author",
                    cell: (row) => (
                      <div>
                        <p>{row.authorName}</p>
                        <p className="text-caption text-secondary">{row.authorUsername ? `@${row.authorUsername}` : row.authorEmail}</p>
                      </div>
                    )
                  },
                  { header: "University", cell: (row) => row.universityName },
                  { header: "Status", cell: (row) => <Badge tone={statusTone(row.status) as any}>{row.status}</Badge> },
                  { header: "Signals", cell: (row) => `${row.likeCount} likes / ${row.commentCount} comments / ${row.openReportCount} open` },
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
              <div>
                <h2 className="text-headline-md font-semibold text-primary">Reports</h2>
                <p className="mt-1 text-body-sm text-secondary">Resolve or dismiss post reports.</p>
              </div>
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
                  { header: "Reporter", cell: (row) => row.reporterUsername ? `@${row.reporterUsername}` : row.reporterEmail },
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

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-headline-md font-semibold text-primary">University access requests</h2>
                <p className="mt-1 text-body-sm text-secondary">Review unknown campus domains before they can be used for signup.</p>
              </div>
              <Badge tone={accessRequests.length ? "warning" : "muted"}>{accessRequests.length} pending</Badge>
            </div>
            {accessRequests.length ? (
              <DataTable
                rows={accessRequests}
                getRowKey={(row) => row.id}
                columns={[
                  {
                    header: "Request",
                    cell: (row) => (
                      <div className="max-w-[320px] whitespace-normal">
                        <p className="text-label-md font-semibold text-primary">{row.universityName || row.emailDomain}</p>
                        <p className="mt-1 text-caption text-secondary">{row.email} / {row.emailDomain}</p>
                      </div>
                    )
                  },
                  { header: "Country", cell: (row) => row.country || "Not provided" },
                  {
                    header: "Website",
                    cell: (row) => row.websiteUrl ? (
                      <a className="text-primary underline-offset-2 hover:underline" href={row.websiteUrl} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    ) : "Not provided"
                  },
                  { header: "Note", cell: (row) => row.note || "No note" },
                  { header: "Created", cell: (row) => formatDateTime(row.createdAt) },
                  {
                    header: "Actions",
                    cell: (row) => (
                      <div className="flex flex-wrap gap-2">
                        <AccessRequestButton requestId={row.id} action={approveUniversityAccessRequestAction} icon="check_circle">Approve</AccessRequestButton>
                        <AccessRequestButton requestId={row.id} action={rejectUniversityAccessRequestAction} icon="block">Reject</AccessRequestButton>
                      </div>
                    )
                  }
                ]}
              />
            ) : (
              <EmptyState icon="mark_email_read" text="No pending university requests." />
            )}
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-headline-md font-semibold text-primary">Universities</h2>
              <p className="mt-1 text-body-sm text-secondary">Manage university spaces and verified email domains.</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              {universities.length ? (
                <DataTable
                  rows={universities}
                  getRowKey={(row) => row.id}
                  columns={[
                    {
                      header: "University",
                      cell: (row) => (
                        <div className="max-w-[260px] whitespace-normal">
                          <p className="text-label-md font-semibold text-primary">{row.name}</p>
                          <p className="mt-1 text-caption text-secondary">{row.slug} / {row.emailDomains.join(", ")}</p>
                          {row.countryName || row.city ? (
                            <p className="mt-1 text-caption text-secondary">{[row.city, row.countryName].filter(Boolean).join(", ")}</p>
                          ) : null}
                        </div>
                      )
                    },
                    { header: "Status", cell: (row) => <Badge tone={statusTone(row.status) as any}>{row.status}</Badge> },
                    { header: "Students", cell: (row) => row.studentCount },
                    { header: "Posts", cell: (row) => row.postCount },
                    { header: "Created", cell: (row) => formatDateTime(row.createdAt) }
                  ]}
                />
              ) : (
                <EmptyState icon="school" text="No universities configured." />
              )}

              <div className="space-y-4">
              <form action={upsertUniversityAction} className="premium-card p-5">
                <h3 className="text-label-lg font-semibold text-primary">Add university</h3>
                <div className="mt-4 grid gap-3">
                  <input name="name" placeholder="University name" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                  <input name="slug" placeholder="slug, e.g. bilkent" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                  <textarea
                    name="emailDomains"
                    placeholder="email domains, e.g. bilkent.edu.tr"
                    className="min-h-[84px] rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 py-3 text-label-md text-primary outline-none focus:border-primary"
                  />
                  <input name="countryCode" placeholder="country code, e.g. TR" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                  <input name="countryName" placeholder="country name" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                  <input name="city" placeholder="city" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                  <input name="websiteUrl" placeholder="website URL" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                  <select name="status" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" defaultValue="active">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <Button type="submit" icon="save">Save university</Button>
                </div>
              </form>
              {universities.length ? (
                <div className="premium-card p-5">
                  <h3 className="text-label-lg font-semibold text-primary">Edit universities</h3>
                  <div className="mt-4 space-y-3">
                    {universities.map((university) => (
                      <details key={university.id} className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-3">
                        <summary className="cursor-pointer text-label-md font-semibold text-primary">{university.name}</summary>
                        <form action={upsertUniversityAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="id" value={university.id} />
                          <input name="name" defaultValue={university.name} className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                          <input name="slug" defaultValue={university.slug} className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                          <textarea
                            name="emailDomains"
                            defaultValue={university.emailDomains.join("\n")}
                            className="min-h-[84px] rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 py-3 text-label-md text-primary outline-none focus:border-primary"
                          />
                          <input name="countryCode" defaultValue={university.countryCode || ""} placeholder="country code" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                          <input name="countryName" defaultValue={university.countryName || ""} placeholder="country name" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                          <input name="city" defaultValue={university.city || ""} placeholder="city" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                          <input name="websiteUrl" defaultValue={university.websiteUrl || ""} placeholder="website URL" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" />
                          <select name="status" className="h-10 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-label-md text-primary outline-none focus:border-primary" defaultValue={university.status}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          <Button type="submit" icon="save">Update</Button>
                        </form>
                      </details>
                    ))}
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  } catch (error) {
    console.error("[admin_social] unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });

    return (
      <section>
        <ScreenHeader title="Social" description="Operate Cadesca university communities." />
        <div className="premium-card p-6 text-center">
          <span className="material-symbols-outlined text-[28px] text-primary" aria-hidden="true">sync_problem</span>
          <h2 className="mt-3 text-headline-md font-semibold text-primary">Social admin is unavailable</h2>
          <p className="mt-2 text-body-md text-secondary">Check the database connection and social schema status.</p>
        </div>
      </section>
    );
  }
}
