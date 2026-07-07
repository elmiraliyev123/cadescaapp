import { Badge } from "@/components/ui/Badge";

export function MerchantRedemptionCard({ employee, order, payment, status }: { employee: string; order: string; payment: string; status: string }) {
  return (
    <div className="premium-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-md font-semibold text-primary">{employee}</p>
          <p className="mt-1 text-caption font-medium text-secondary">{order}</p>
        </div>
        <Badge>{status}</Badge>
      </div>
      <div className="mt-4 rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-caption font-semibold text-primary">
        {payment}
      </div>
    </div>
  );
}
