"use client";

import type { PaymentType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PaymentSelector } from "@/components/forms/PaymentSelector";
import { useLanguage } from "@/lib/i18n";

export function MerchantPaymentForm({
  employeeCode,
  amount,
  paymentType,
  onEmployeeCodeChange,
  onAmountChange,
  onPaymentTypeChange,
  onConfirm,
  cmuBalance
}: {
  employeeCode: string;
  amount: string;
  paymentType: PaymentType;
  onEmployeeCodeChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPaymentTypeChange: (value: PaymentType) => void;
  onConfirm: () => void;
  cmuBalance: number;
}) {
  const { t } = useLanguage();
  const parsedAmount = Number.parseFloat(amount) || 0;
  const cmuInsufficient = cmuBalance < 1;
  const isDisabled =
    (paymentType === "cmu" && cmuInsufficient) ||
    (paymentType === "split" && cmuInsufficient) ||
    parsedAmount < 0;

  return (
    <div className="premium-card p-5">
      <h2 className="text-headline-md font-semibold text-primary">{t("merchant.acceptPayment")}</h2>
      <div className="mt-5 grid gap-4">
        <Input label={t("merchant.employeeCode")} icon="qr_code_scanner" value={employeeCode} onChange={(event) => onEmployeeCodeChange(event.target.value)} />
        <div>
          <PaymentSelector value={paymentType} onChange={onPaymentTypeChange} />
          {(paymentType === "cmu" || paymentType === "split") && cmuInsufficient && (
            <p className="mt-1.5 text-caption font-medium text-secondary">No CMU available — employee cannot use CMU payment.</p>
          )}
        </div>
        
        {paymentType !== "cmu" && (
          <Input 
            label={paymentType === "split" ? t("merchant.extraAznAmount") : "Amount to charge"} 
            icon="payments" 
            value={amount} 
            onChange={(event) => onAmountChange(event.target.value)} 
            inputMode="decimal" 
          />
        )}
        
        {paymentType === "cmu" && !cmuInsufficient && (
          <p className="text-body-sm text-secondary">This will deduct 1 CMU from the employee.</p>
        )}
        {paymentType === "split" && !cmuInsufficient && (
          <p className="text-body-sm text-secondary">This will deduct 1 CMU plus the extra AZN amount.</p>
        )}

        <Button size="lg" className="w-full" icon="check_circle" onClick={onConfirm} disabled={isDisabled}>
          {t("merchant.confirmPayment")}
        </Button>
      </div>
    </div>
  );
}
