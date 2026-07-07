"use client";

import { useState } from "react";
import type { PaymentType, Redemption } from "@/lib/types";
import type { Employee } from "@/lib/demoData";
import { MerchantRedemptionCard } from "@/components/cards/MerchantCard";
import { StatCard } from "@/components/cards/StatCard";
import { MerchantPaymentForm } from "@/components/forms/MerchantPaymentForm";
import { Modal } from "@/components/ui/Modal";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/lib/i18n";

export function MerchantPaymentScreen({
  redemptions,
  dailyCmu,
  dailyAzn,
  onApprovePayment,
  onVerifyEmployee,
  merchantName
}: {
  redemptions: Redemption[];
  dailyCmu: number;
  dailyAzn: number;
  merchantName: string;
  onVerifyEmployee: (employeeCode: string) => Employee | null;
  onApprovePayment: (input: { employeeId: string; paymentType: PaymentType; amount: number; employeeCode: string; itemName: string }) => void;
}) {
  const { t } = useLanguage();
  const [paymentType, setPaymentType] = useState<PaymentType>("split");
  const [employeeCode, setEmployeeCode] = useState("CMU-AZN-8421");
  const [amount, setAmount] = useState("4.00");
  const [open, setOpen] = useState(false);
  // Verify employee step
  const [verifyStep, setVerifyStep] = useState<"input" | "preview" | "payment">("input");
  const [verifiedEmployee, setVerifiedEmployee] = useState<Employee | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const paymentLabel =
    paymentType === "cmu"
      ? `Deduct 1 CMU from ${verifiedEmployee?.name || "employee"}.`
      : paymentType === "azn"
        ? `Deduct ${amount || "0.00"} AZN from ${verifiedEmployee?.name || "employee"}.`
        : `Deduct 1 CMU + ${amount || "0.00"} AZN from ${verifiedEmployee?.name || "employee"}.`;

  function approvePayment() {
    if (!verifiedEmployee) return;
    onApprovePayment({
      employeeId: verifiedEmployee.id,
      paymentType,
      amount: Number.parseFloat(amount) || 0,
      employeeCode,
      itemName: "Chicken Bowl + Coffee"
    });
    setOpen(false);
    // Reset to input step for next payment
    setVerifyStep("input");
    setEmployeeCode("CMU-AZN-8421");
    setAmount("4.00");
    setPaymentType("split");
    setVerifiedEmployee(null);
  }

  function handleVerify() {
    if (!employeeCode.trim()) return;
    const employee = onVerifyEmployee(employeeCode);
    if (!employee) {
      setVerifyError("No employee found for this code");
      return;
    }
    setVerifiedEmployee(employee);
    setVerifyError("");
    setVerifyStep("preview");
  }

  function handleContinueToPayment() {
    setVerifyStep("payment");
  }

  function handleBackToInput() {
    setVerifyStep("input");
    setVerifiedEmployee(null);
  }

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 border-b border-outline-variant/70 pb-5 md:mb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Logo maxWidth={130} />
          <h1 className="mt-6 text-headline-lg-mobile font-semibold tracking-[-0.01em] text-primary md:text-headline-lg">{t("merchant.merchantPayment")}</h1>
          <p className="mt-2 max-w-2xl text-body-md text-secondary">
            {merchantName} point-of-sale flow for CMU redemption, AZN wallet payment, or a clean split transaction.
          </p>
        </div>
        <StatCard label={t("merchant.dailyTotal")} value={`${dailyCmu} CMU`} detail={`Plus ${dailyAzn.toFixed(2)} AZN extras`} icon="point_of_sale" className="md:w-[280px]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
        {verifyStep === "input" && (
          <div className="premium-card p-5">
            <h2 className="text-headline-md font-semibold text-primary">{t("merchant.verifyEmployee")}</h2>
            <p className="mt-2 text-body-md text-secondary">Enter or scan the employee&apos;s payment code to begin.</p>
            <div className="mt-5 grid gap-4">
              <Input label={t("merchant.employeeCode")} icon="qr_code_scanner" value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
              {verifyError && <p className="text-caption font-semibold text-secondary">{verifyError}</p>}
              <Button size="lg" className="w-full" icon="verified" onClick={handleVerify} disabled={!employeeCode.trim()}>
                {t("merchant.verifyEmployee")}
              </Button>
            </div>
          </div>
        )}
        {verifyStep === "preview" && (
          <div className="premium-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md font-semibold text-primary">Employee verified</h2>
              <Badge tone="inverse">Active</Badge>
            </div>
            <div className="mt-5 rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person</span>
                </div>
                <div>
                  <p className="text-label-md font-semibold text-primary">{verifiedEmployee?.name}</p>
                  <p className="text-caption font-medium text-secondary">{verifiedEmployee?.department}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low px-3 py-2.5">
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">CMU balance</p>
                  <p className="mt-1 text-label-md font-semibold text-primary">{verifiedEmployee?.cmuBalance ?? 0} CMU</p>
                </div>
                <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low px-3 py-2.5">
                  <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">AZN balance</p>
                  <p className="mt-1 text-label-md font-semibold text-primary">{(verifiedEmployee?.aznBalance ?? 0).toFixed(2)} AZN</p>
                </div>
              </div>
              <p className="mt-3 text-caption font-medium text-secondary">Code: {employeeCode}</p>
            </div>
            <div className="mt-5 grid gap-3">
              <Button size="lg" className="w-full" icon="arrow_forward" onClick={handleContinueToPayment}>
                Continue to payment
              </Button>
              <Button size="lg" variant="secondary" className="w-full" icon="arrow_back" onClick={handleBackToInput}>
                Scan different employee
              </Button>
            </div>
          </div>
        )}
        {verifyStep === "payment" && (
          <div>
            <MerchantPaymentForm
              employeeCode={employeeCode}
              amount={amount}
              paymentType={paymentType}
              onEmployeeCodeChange={setEmployeeCode}
              onAmountChange={setAmount}
              onPaymentTypeChange={setPaymentType}
              onConfirm={() => setOpen(true)}
              cmuBalance={verifiedEmployee?.cmuBalance ?? 0}
            />
            <button
              type="button"
              onClick={handleBackToInput}
              className="mt-3 w-full text-center text-[13px] font-semibold text-secondary hover:text-primary hover:underline"
            >
              ← Back to employee verification
            </button>
          </div>
        )}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-md font-semibold text-primary">{t("merchant.recentRedemptions")}</h2>
            <span className="text-caption font-semibold text-secondary">{redemptions.length} approved</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {redemptions.map((redemption) => (
              <MerchantRedemptionCard key={redemption.id} {...redemption} />
            ))}
          </div>
        </div>
      </div>
      <Modal
        open={open}
        title={t("merchant.paymentApproved")}
        description="This will create an approved merchant redemption in the demo."
        confirmLabel="Approve"
        onClose={() => setOpen(false)}
        onConfirm={approvePayment}
      >
        <div className="premium-card-muted p-4">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Employee</p>
          <p className="mt-2 text-label-md font-semibold text-primary">{verifiedEmployee?.name} | {employeeCode}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-caption font-medium text-secondary">CMU balance</p>
              <p className="text-label-md font-semibold text-primary">{verifiedEmployee?.cmuBalance ?? 0} CMU</p>
            </div>
            <div>
              <p className="text-caption font-medium text-secondary">AZN balance</p>
              <p className="text-label-md font-semibold text-primary">{(verifiedEmployee?.aznBalance ?? 0).toFixed(2)} AZN</p>
            </div>
          </div>
          <p className="mt-4 text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Payment</p>
          <p className="mt-2 text-label-md font-semibold text-primary">{paymentLabel}</p>
        </div>
      </Modal>
    </section>
  );
}
