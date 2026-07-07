"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { Employee } from "@/lib/demoData";
import {
  getActiveEmployeeCount,
  getCompanyUsageBars,
  getCompanyEmployees,
  getEmployerUsage,
  getMenuMerchants,
  getPrimaryCompany,
  getTopMerchants,
  PRIMARY_COMPANY_ID,
  PRIMARY_EMPLOYEE_ID,
  toEmployeeRows,
  toMerchantCards,
  useDemoState
} from "@/lib/demoStore";
import { EmployerDashboardScreen } from "@/components/screens/EmployerDashboardScreen";
import { ScreenHeader } from "@/components/screens/ScreenHeader";
import { StatCard } from "@/components/cards/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { formatAzn } from "@/lib/utils";

export function EmployerDashboardPage() {
  const router = useRouter();
  const { state, dispatch } = useDemoState();
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const company = getPrimaryCompany(state);
  const companyEmployees = getCompanyEmployees(state, PRIMARY_COMPANY_ID);
  const usage = getEmployerUsage(state, PRIMARY_COMPANY_ID);
  const activeEmployeeCount = getActiveEmployeeCount(state, PRIMARY_COMPANY_ID);
  const activeMerchantCount = Object.values(state.merchants).filter((merchant) => merchant.status === "available" || merchant.status === "approved").length;

  if (!company) return null;

  return (
    <>
      <EmployerDashboardScreen
        employees={toEmployeeRows(companyEmployees)}
        merchants={toMerchantCards(getMenuMerchants(state))}
        cmuUsed={usage.cmuUsed}
        aznUsed={usage.aznUsed}
        activeEmployees={activeEmployeeCount}
        monthlyBudget={company.monthlyBudget}
        activeMerchants={activeMerchantCount}
        topMerchants={getTopMerchants(state, PRIMARY_COMPANY_ID)}
        usageBars={getCompanyUsageBars(state, PRIMARY_COMPANY_ID)}
        onAddEmployee={() => setAddEmployeeOpen(true)}
        onTopUpBalance={() => setTopUpOpen(true)}
        onTravelPolicy={() => router.push("/app/employer/travel-policy")}
        onDownloadReport={() => dispatch({ type: "SHOW_TOAST", payload: { message: "Demo report generated" } })}
      />
      <AddEmployeeModal open={addEmployeeOpen} onClose={() => setAddEmployeeOpen(false)} />
      <TopUpEmployeeModal employees={companyEmployees} open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </>
  );
}

export function EmployerEmployeesPage() {
  const { state } = useDemoState();
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const employees = getCompanyEmployees(state, PRIMARY_COMPANY_ID);
  const employeeRows = toEmployeeRows(employees);

  return (
    <section>
      <ScreenHeader
        title="Employees"
        description="Employee meal benefit balances for this employer account."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon="add_card" onClick={() => setTopUpOpen(true)}>Top up balance</Button>
            <Button icon="person_add" onClick={() => setAddEmployeeOpen(true)}>Add employee</Button>
          </div>
        }
      />
      <DataTable
        rows={employeeRows}
        getRowKey={(row) => row.id}
        columns={[
          { header: "Employee", cell: (row) => row.name },
          { header: "Department", cell: (row) => row.department },
          { header: "CMU balance", cell: (row) => `${row.cmu} CMU` },
          { header: "AZN balance", cell: (row) => row.azn },
          { header: "Status", cell: (row) => <Badge tone={row.status === "Active" ? "default" : "warning"}>{row.status}</Badge> }
        ]}
      />
      <AddEmployeeModal open={addEmployeeOpen} onClose={() => setAddEmployeeOpen(false)} />
      <TopUpEmployeeModal employees={employees} open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </section>
  );
}

export function EmployerBudgetsPage() {
  const { state } = useDemoState();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const company = getPrimaryCompany(state);
  const employees = getCompanyEmployees(state, PRIMARY_COMPANY_ID);
  const usage = getEmployerUsage(state, PRIMARY_COMPANY_ID);
  const totalCmu = employees.reduce((sum, employee) => sum + employee.cmuBalance, 0);
  const totalAzn = employees.reduce((sum, employee) => sum + employee.aznBalance, 0);
  const remaining = Math.max(0, (company?.monthlyBudget || 0) - usage.aznUsed);

  return (
    <section>
      <ScreenHeader title="Budgets" description="Meal benefit allocations, CMU usage and AZN wallet spend for the current employer." action={<Button icon="add_card" onClick={() => setTopUpOpen(true)}>Top up balance</Button>} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total budget" value={`${(company?.monthlyBudget || 0).toLocaleString("en-US")} AZN`} detail="Monthly allocation" icon="account_balance" />
        <StatCard label="CMU used" value={`${usage.cmuUsed}`} detail={`${totalCmu} CMU remaining with employees`} icon="restaurant" />
        <StatCard label="AZN used" value={`${usage.aznUsed.toFixed(2)} AZN`} detail={`${formatAzn(totalAzn)} in employee wallets`} icon="payments" />
        <StatCard label="Remaining" value={`${remaining.toFixed(2)} AZN`} detail="Derived from shared usage" icon="savings" />
      </div>
      <div className="mt-5 premium-card p-5">
        <h2 className="text-headline-md font-semibold text-primary">Employee allocations</h2>
        <div className="mt-4">
          <DataTable
            rows={toEmployeeRows(employees)}
            getRowKey={(row) => row.id}
            columns={[
              { header: "Employee", cell: (row) => row.name },
              { header: "Department", cell: (row) => row.department },
              { header: "CMU balance", cell: (row) => `${row.cmu} CMU` },
              { header: "AZN balance", cell: (row) => row.azn },
              { header: "Status", cell: (row) => <Badge tone={row.status === "Active" ? "default" : "warning"}>{row.status}</Badge> }
            ]}
          />
        </div>
      </div>
      <TopUpEmployeeModal employees={employees} open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </section>
  );
}

export function EmployerReportsPage() {
  const { state, dispatch } = useDemoState();
  const usage = getEmployerUsage(state, PRIMARY_COMPANY_ID);
  const topMerchants = getTopMerchants(state, PRIMARY_COMPANY_ID);

  return (
    <section>
      <ScreenHeader title="Reports" description="Finance-ready usage exports for CMU redemptions, wallet payments and merchant activity." action={<Button icon="download" onClick={() => dispatch({ type: "SHOW_TOAST", payload: { message: "Demo report generated" } })}>Download report</Button>} />
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="CMU report" value={`${usage.cmuUsed}`} detail="Meal unit usage" icon="receipt_long" />
        <StatCard label="AZN report" value={`${usage.aznUsed.toFixed(2)} AZN`} detail="Wallet payments" icon="payments" />
        <StatCard label="Merchants" value={`${topMerchants.length}`} detail="Active in this company ledger" icon="storefront" />
      </div>
      <div className="mt-5 premium-card p-5">
        <h2 className="text-headline-md font-semibold text-primary">Top merchants</h2>
        <div className="mt-4 divide-y divide-outline-variant/70">
          {topMerchants.map((merchant) => (
            <div key={merchant.merchantName} className="flex items-center justify-between gap-4 py-4">
              <div>
                <span className="text-label-md font-semibold text-primary">{merchant.merchantName}</span>
                <p className="mt-1 text-caption font-medium text-secondary">{merchant.transactions} transactions</p>
              </div>
              <span className="text-label-md font-semibold text-primary">{merchant.cmu} CMU / {merchant.azn.toFixed(2)} AZN</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EmployerTravelPolicyPage() {
  const { state, dispatch } = useDemoState();

  return (
    <section>
      <ScreenHeader title="Travel Policy" description="Control how employee CMU balances convert during approved business travel." action={<Button icon="save" onClick={() => dispatch({ type: "SHOW_TOAST", payload: { message: "Travel policy saved" } })}>Save policy</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="premium-card p-5">
          <h2 className="text-headline-md font-semibold text-primary">Enabled countries</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.values(state.travelRates).map((rate) => (
              <div key={rate.code} className="rounded-xl border border-outline-variant/70 bg-surface-container-low p-4">
                <p className="text-label-md font-semibold text-primary">{rate.country}</p>
                <p className="mt-1 text-caption font-medium text-secondary">1 CMU = {rate.localValue}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-primary bg-primary p-5 text-on-primary">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-inverse-primary">Policy status</p>
          <p className="mt-4 text-headline-md font-semibold">Borderless meal benefit</p>
          <p className="mt-2 text-body-md text-inverse-primary">Employees can use CMU abroad without separate per-diem administration.</p>
        </div>
      </div>
    </section>
  );
}

function AddEmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemoState();
  const [name, setName] = useState("Nigar S.");
  const [email, setEmail] = useState("nigar@northstar.example");
  const [department, setDepartment] = useState("Design");
  const [cmuBalance, setCmuBalance] = useState("10");
  const [aznBalance, setAznBalance] = useState("50");

  function handleConfirm() {
    dispatch({
      type: "ADD_EMPLOYEE",
      payload: {
        name: name.trim() || "New Employee",
        email: email.trim(),
        department: department.trim() || "General",
        companyId: PRIMARY_COMPANY_ID,
        cmuBalance: Number.parseInt(cmuBalance, 10) || 0,
        aznBalance: Number.parseFloat(aznBalance) || 0
      }
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} onConfirm={handleConfirm} title="Add employee" description="Add a new employee to the shared Cadesca demo account." confirmLabel="Add employee">
      <div className="grid gap-4 p-1">
        <Input label="Name" icon="person" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Email" icon="mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <Input label="Department" icon="work" value={department} onChange={(event) => setDepartment(event.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Initial CMU" icon="restaurant" value={cmuBalance} onChange={(event) => setCmuBalance(event.target.value)} />
          <Input label="Initial AZN" icon="payments" value={aznBalance} onChange={(event) => setAznBalance(event.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function TopUpEmployeeModal({ employees, open, onClose }: { employees: Employee[]; open: boolean; onClose: () => void }) {
  const { dispatch } = useDemoState();
  const [employeeId, setEmployeeId] = useState(PRIMARY_EMPLOYEE_ID);
  const [cmuAmount, setCmuAmount] = useState("5");
  const [aznAmount, setAznAmount] = useState("20");
  const selectedEmployeeId = employees.some((employee) => employee.id === employeeId) ? employeeId : "";

  function handleConfirm() {
    if (!selectedEmployeeId) return;
    dispatch({
      type: "TOP_UP_EMPLOYEE_BALANCE",
      payload: {
        employeeId: selectedEmployeeId,
        cmuAmount: Number.parseInt(cmuAmount, 10) || 0,
        aznAmount: Number.parseFloat(aznAmount) || 0
      }
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} onConfirm={handleConfirm} title="Top up balance" description="Add CMU or AZN to an employee's wallet. This updates Employee, Employer and Admin views." confirmLabel="Confirm top up">
      <div className="grid gap-4 p-1">
        <label className="block">
          <span className="mb-2 block text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Employee</span>
          <select
            value={selectedEmployeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="h-11 w-full rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 text-body-md text-on-surface outline-none transition-colors focus:border-primary"
          >
            <option value="" disabled>Select an employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Input label="CMU Amount" icon="restaurant" value={cmuAmount} onChange={(event) => setCmuAmount(event.target.value)} />
          <Input label="AZN Amount" icon="payments" value={aznAmount} onChange={(event) => setAznAmount(event.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
