"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeWalletScreen } from "@/components/screens/EmployeeWalletScreen";
import { CadescaMenuScreen } from "@/components/screens/CadescaMenuScreen";
import { TravelModeScreen } from "@/components/screens/TravelModeScreen";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { TransactionList } from "@/components/cards/TransactionList";
import { BalanceCard } from "@/components/cards/BalanceCard";
import { Modal } from "@/components/ui/Modal";
import {
  getEmployeeById,
  getEmployeeTransactions,
  getMenuMerchants,
  getTravelRates,
  PRIMARY_EMPLOYEE_ID,
  PRIMARY_MERCHANT_ID,
  toActivityItems,
  toMerchantCards,
  toTravelRateCards,
  useDemoState
} from "@/lib/demoStore";
import { formatAzn } from "@/lib/utils";

type EmployeePaymentAction = "azn" | "split" | null;

export function EmployeeWalletPage() {
  const router = useRouter();
  const { state, dispatch } = useDemoState();
  const employee = getEmployeeById(state, PRIMARY_EMPLOYEE_ID);
  const transactions = employee ? toActivityItems(getEmployeeTransactions(state, employee.id)) : [];
  const [paymentAction, setPaymentAction] = useState<EmployeePaymentAction>(null);

  function confirmPayment() {
    if (!employee) return;
    if (paymentAction === "azn") {
      dispatch({
        type: "PAY_AZN",
        payload: {
          employeeId: employee.id,
          merchantId: PRIMARY_MERCHANT_ID,
          amount: 12.8,
          description: "Regular wallet payment"
        }
      });
    }
    if (paymentAction === "split") {
      dispatch({
        type: "PAY_SPLIT",
        payload: {
          employeeId: employee.id,
          merchantId: PRIMARY_MERCHANT_ID,
          cmuAmount: 1,
          aznAmount: 4,
          itemName: "Chicken Bowl + Coffee"
        }
      });
    }
    setPaymentAction(null);
  }

  if (!employee) return null;

  return (
    <>
      <EmployeeWalletScreen
        cmu={employee.cmuBalance}
        azn={formatAzn(employee.aznBalance)}
        todayMeal="Available"
        transactions={transactions.slice(0, 5)}
        onRedeem={() =>
          dispatch({
            type: "REDEEM_CMU",
            payload: {
              employeeId: employee.id,
              merchantId: PRIMARY_MERCHANT_ID,
              itemName: "Cadesca Menu"
            }
          })
        }
        onPayAzn={() => setPaymentAction("azn")}
        onSplit={() => setPaymentAction("split")}
        onNavigateMenu={() => router.push("/app/employee/menu")}
        onNavigateTravel={() => router.push("/app/employee/travel")}
      />
      <Modal
        open={paymentAction !== null}
        title={paymentAction === "split" ? "Confirm split payment" : "Confirm AZN wallet payment"}
        description={paymentAction === "split" ? "Redeem one partner meal and pay the coffee extra from AZN Wallet." : "Approve a mock wallet payment from the employee balance."}
        confirmLabel={paymentAction === "split" ? "Approve split" : "Approve payment"}
        onClose={() => setPaymentAction(null)}
        onConfirm={confirmPayment}
      >
        <div className="premium-card-muted p-4">
          <div className="flex items-center justify-between border-b border-outline-variant/70 pb-3">
            <span className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Current CMU</span>
            <span className="text-label-md font-semibold text-primary">{employee.cmuBalance} CMU</span>
          </div>
          <div className="flex items-center justify-between border-b border-outline-variant/70 py-3">
            <span className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Current AZN</span>
            <span className="text-label-md font-semibold text-primary">{formatAzn(employee.aznBalance)}</span>
          </div>
          <div className="flex items-center justify-between pt-3">
            <span className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Payment</span>
            <span className="text-label-md font-semibold text-primary">{paymentAction === "split" ? "1 CMU + 4.00 AZN" : "12.80 AZN"}</span>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function EmployeeMenuPage() {
  const { state, dispatch } = useDemoState();
  const employee = getEmployeeById(state, PRIMARY_EMPLOYEE_ID);
  const merchants = toMerchantCards(getMenuMerchants(state));

  if (!employee) return null;

  return (
    <CadescaMenuScreen
      merchants={merchants}
      onRedeem={(merchantId, mealName) =>
        dispatch({
          type: "REDEEM_CMU",
          payload: {
            employeeId: employee.id,
            merchantId,
            itemName: mealName
          }
        })
      }
      cmuBalance={employee.cmuBalance}
    />
  );
}

export function EmployeeTravelPage() {
  const { state, dispatch } = useDemoState();
  const employee = getEmployeeById(state, PRIMARY_EMPLOYEE_ID);

  return (
    <TravelModeScreen
      countries={toTravelRateCards(getTravelRates(state), employee)}
      selectedCode={state.selectedCountry}
      onSelect={(country) => dispatch({ type: "SET_SELECTED_COUNTRY", payload: { country } })}
    />
  );
}

export function EmployeeActivityPage() {
  const { state } = useDemoState();
  const employee = getEmployeeById(state, PRIMARY_EMPLOYEE_ID);
  const transactions = employee ? toActivityItems(getEmployeeTransactions(state, employee.id)) : [];

  if (!employee) return null;

  return (
    <section>
      <ScreenHeader title="Activity" description="Your CMU redemptions, AZN wallet payments and split meal transactions." />
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="grid gap-4">
          <BalanceCard title="CMU balance" value={`${employee.cmuBalance} CMU`} subtitle="Available employee meal units" icon="restaurant" badge="Active" />
          <BalanceCard title="AZN Wallet" value={formatAzn(employee.aznBalance)} subtitle="Available extras balance" icon="account_balance_wallet" badge="Wallet" />
        </div>
        <TransactionList transactions={transactions} />
      </div>
    </section>
  );
}
