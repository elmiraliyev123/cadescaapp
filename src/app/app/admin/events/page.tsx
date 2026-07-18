import { redirect } from "next/navigation";

import { AdminEventsOperationsView } from "@/components/events/AdminEventsOperationsView";
import { AdminEventsModerationView } from "@/components/events/AdminEventsModerationView";
import { EventsRouteError } from "@/components/events/EventPrimitives";
import { requireAdminSession } from "@/lib/server/adminAuth";
import { getAdminEventsOperations } from "@/lib/server/adminEvents";
import { listAdminEventModeration } from "@/lib/server/events";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  try {
    await requireAdminSession();
  } catch {
    redirect("/admin/login");
  }
  try {
    const [events, operations] = await Promise.all([
      listAdminEventModeration(),
      getAdminEventsOperations()
    ]);
    return (
      <div className="space-y-8">
        <AdminEventsModerationView events={events} />
        <AdminEventsOperationsView data={operations} />
      </div>
    );
  } catch (error) {
    console.error("[admin_events] unavailable", { reason: error instanceof Error ? error.name : "unknown" });
    return <EventsRouteError error={(error as { code?: string })?.code} />;
  }
}
