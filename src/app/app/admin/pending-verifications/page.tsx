import { redirect } from "next/navigation";

import { approveStudentVerification, rejectStudentVerification } from "./actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { getAdminSessionFromCookies } from "@/lib/server/adminAuth";
import { createStudentIdSignedUrl, studentIdObjectPath } from "@/lib/server/studentIdReview";
import { getReadyPool } from "@/lib/server/users";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PendingUserRow = {
  id: string;
  name: string;
  email: string;
  university_name: string | null;
  university_domain: string | null;
  student_id_image_path: string | null;
  student_number: string | null;
  student_id_expires_at: string | null;
  student_id_issued_at: string | null;
  student_faculty_department: string | null;
  verified_via: string;
  created_at: string;
};

type PendingVerification = PendingUserRow & {
  signedImageUrl: string | null;
};

async function signedUrlForUser(row: PendingUserRow) {
  const candidates = [
    row.student_id_image_path,
    studentIdObjectPath(row.id, "jpg"),
    studentIdObjectPath(row.id, "png")
  ].filter(Boolean) as string[];

  for (const objectPath of candidates) {
    const signedUrl = await createStudentIdSignedUrl(objectPath);
    if (signedUrl) return signedUrl;
  }

  return null;
}

async function getPendingVerifications(): Promise<PendingVerification[]> {
  await getReadyPool();

  const { data, error } = await getSupabaseAdminClient()
    .from("users")
    .select("id,name,email,university_name,university_domain,student_id_image_path,student_number,student_id_expires_at,student_id_issued_at,student_faculty_department,verified_via,created_at")
    .eq("student_status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    ((data || []) as PendingUserRow[]).map(async (row) => ({
      ...row,
      signedImageUrl: await signedUrlForUser(row)
    }))
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function PendingVerificationsPage() {
  const session = await getAdminSessionFromCookies();
  if (!session) redirect("/admin/login");

  const pendingUsers = await getPendingVerifications();

  return (
    <section>
      <ScreenHeader
        title="Pending Verifications"
        description="Review student ID uploads that fell back from OCR to manual verification."
        action={<Badge tone="warning">{pendingUsers.length} pending</Badge>}
      />

      {pendingUsers.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {pendingUsers.map((user) => (
            <article key={user.id} className="premium-card overflow-hidden">
              <div className="border-b border-outline-variant/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-title-lg font-semibold text-primary">{user.name}</h2>
                    <p className="mt-1 text-body-sm text-secondary">{user.email}</p>
                  </div>
                  <Badge tone="warning">Manual review</Badge>
                </div>
                <dl className="mt-4 grid gap-3 text-body-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Created</dt>
                    <dd className="mt-1 text-primary">{formatDate(user.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Image Path</dt>
                    <dd className="mt-1 break-all text-primary">{user.student_id_image_path || "Not recorded"}</dd>
                  </div>
                </dl>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-4">
                  <form action={approveStudentVerification} className="space-y-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <label className="block">
                      <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">University Name</span>
                      <input
                        name="universityName"
                        defaultValue={user.university_name || ""}
                        required
                        className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">University Domain</span>
                      <input
                        name="universityDomain"
                        defaultValue={user.university_domain || ""}
                        placeholder="example.edu"
                        className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Student Number</span>
                      <input
                        name="studentNumber"
                        defaultValue={user.student_number || ""}
                        className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Issue Date</span>
                        <input
                          type="date"
                          name="studentIdIssuedAt"
                          defaultValue={user.student_id_issued_at || ""}
                          className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Expiration Date</span>
                        <input
                          type="date"
                          name="studentIdExpiresAt"
                          defaultValue={user.student_id_expires_at || ""}
                          className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Faculty / Department</span>
                      <input
                        name="studentFacultyDepartment"
                        defaultValue={user.student_faculty_department || ""}
                        className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" icon="verified">
                        Approve
                      </Button>
                    </div>
                  </form>

                  <form action={rejectStudentVerification}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button type="submit" size="sm" variant="secondary" icon="block">
                      Reject
                    </Button>
                  </form>
                </div>

                <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-2">
                  {user.signedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.signedImageUrl}
                      alt={`Student ID uploaded by ${user.name}`}
                      className="h-64 w-full rounded-md object-contain"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-md bg-surface-container-lowest px-4 text-center text-caption font-semibold text-secondary">
                      No signed image URL could be generated.
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="premium-card p-8 text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary" aria-hidden="true">fact_check</span>
          <h2 className="mt-3 text-title-lg font-semibold text-primary">No pending verifications</h2>
          <p className="mt-2 text-body-md text-secondary">New OCR fallback submissions will appear here with a private signed image preview.</p>
        </div>
      )}
    </section>
  );
}
