import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { getAdminSessionFromCookies } from "@/lib/server/adminAuth";
import { isGoogleWalletConfigured, listGoogleWalletPasses } from "@/lib/server/googleWallet";

import {
  disableStudentAction,
  forceUpdateWalletPassAction,
  reissueWalletPassAction,
  revokeWalletPassAction
} from "./actions";

export const dynamic = "force-dynamic";

type AdminWalletPassRow = Awaited<ReturnType<typeof listGoogleWalletPasses>>[number] & {
  name: string;
  email: string;
  user_status: string;
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not synced";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusTone(status: string, revoked: boolean): "success" | "warning" | "muted" {
  if (revoked || status === "revoked" || status === "expired") return "warning";
  if (status === "active") return "success";
  return "muted";
}

function WalletActionForm({
  action,
  userId,
  icon,
  children,
  variant = "secondary"
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  icon: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant={variant} icon={icon}>
        {children}
      </Button>
    </form>
  );
}

export default async function AdminWalletPassesPage() {
  const session = await getAdminSessionFromCookies();
  if (!session) redirect("/admin/login");

  const configured = isGoogleWalletConfigured();
  const passes = (await listGoogleWalletPasses()) as AdminWalletPassRow[];

  return (
    <section>
      <ScreenHeader
        title="Google Wallet Passes"
        description="Manage Cadesca student passes, revocation, reissue, and forced Wallet updates."
        action={<Badge tone={configured ? "success" : "warning"}>{configured ? "Configured" : "Not configured"}</Badge>}
      />

      {!configured ? (
        <div className="premium-card mb-4 p-5">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[22px] text-secondary" aria-hidden="true">key_off</span>
            <div>
              <h2 className="text-title-md font-semibold text-primary">Google Wallet environment is incomplete</h2>
              <p className="mt-1 text-body-sm text-secondary">
                Set issuer, class, and service account variables before issuing production passes.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {passes.length ? (
        <div className="overflow-hidden rounded-lg border border-outline-variant/70 bg-surface">
          <table className="min-w-full divide-y divide-outline-variant/70 text-left text-body-sm">
            <thead className="bg-surface-container-low text-caption font-semibold uppercase tracking-[0.08em] text-secondary">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Sync</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
              {passes.map((pass) => (
                <tr key={pass.id} className="bg-surface">
                  <td className="px-4 py-4 align-top">
                    <div className="font-semibold text-primary">{pass.name}</div>
                    <div className="mt-1 text-caption text-secondary">{pass.email}</div>
                    <div className="mt-2 text-caption text-secondary">{pass.university_name || "University not recorded"}</div>
                  </td>
                  <td className="max-w-[280px] px-4 py-4 align-top">
                    <div className="break-all font-mono text-caption text-primary">{pass.unique_wallet_pass_id}</div>
                    <div className="mt-2 break-all text-[11px] text-secondary">{pass.google_object_id}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-secondary">
                    <div>{formatDate(pass.last_sync)}</div>
                    <div className="mt-2 text-caption">Expires {formatDate(pass.expires_at)}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col items-start gap-2">
                      <Badge tone={statusTone(pass.status, pass.revoked)}>{pass.revoked ? "revoked" : pass.status}</Badge>
                      <Badge tone={pass.user_status === "active" ? "success" : "warning"}>{pass.user_status}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      <WalletActionForm action={forceUpdateWalletPassAction} userId={pass.user_id} icon="sync">
                        Update
                      </WalletActionForm>
                      <WalletActionForm action={reissueWalletPassAction} userId={pass.user_id} icon="restart_alt">
                        Reissue
                      </WalletActionForm>
                      <WalletActionForm action={revokeWalletPassAction} userId={pass.user_id} icon="block" variant="quiet">
                        Revoke
                      </WalletActionForm>
                      <WalletActionForm action={disableStudentAction} userId={pass.user_id} icon="person_off" variant="quiet">
                        Disable
                      </WalletActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="premium-card p-8 text-center">
          <span className="material-symbols-outlined text-[40px] text-secondary" aria-hidden="true">wallet</span>
          <h2 className="mt-3 text-title-lg font-semibold text-primary">No Google Wallet passes yet</h2>
          <p className="mt-2 text-body-md text-secondary">Verified students appear here after creating their first Google Wallet pass.</p>
        </div>
      )}
    </section>
  );
}
