"use client";

import { useRouter } from "next/navigation";
import type { DemoRole } from "@/lib/types";
import { roleHome } from "@/components/app/role-navigation";
import { useDemoState } from "@/lib/demoStore";
import { demoModeEnabled } from "@/lib/appConfig";

const roles: Array<{ id: DemoRole; label: string }> = [
  { id: "user", label: "User" },
  { id: "employee", label: "Employee" },
  { id: "merchant", label: "Merchant" },
  { id: "employer", label: "Employer" },
  { id: "admin", label: "Admin" }
];

export function DemoRoleSwitcher({ role }: { role: DemoRole }) {
  const router = useRouter();
  const { state, dispatch } = useDemoState();

  if (!demoModeEnabled || state.presentationMode) {
    return null;
  }

  function handleRoleChange(newRole: DemoRole) {
    if (newRole === "user") {
      dispatch({
        type: "REGISTER_USER_ACCOUNT",
        payload: {
          name: "Ali Mammadov",
          email: "ali@ada.edu.az",
          password: "Cadesca1!",
          acceptedTermsAt: new Date().toISOString(),
          emailVerified: true
        }
      });
    } else if (newRole === "merchant" || newRole === "admin") {
      dispatch({ type: "SET_SELECTED_ROLE", payload: { role: newRole } });
    } else {
      return;
    }
    router.push(roleHome[newRole]);
  }

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-secondary">Demo Mode</span>
        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as DemoRole)}
          className="bg-transparent text-[11px] font-semibold text-primary outline-none focus:ring-0 cursor-pointer"
        >
          {roles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => dispatch({ type: "RESET_DEMO_DATA" })}
          className="flex-1 rounded-md border border-outline-variant/70 bg-surface-container-lowest px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-surface-container-low"
        >
          Reset data
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_PRESENTATION_MODE", payload: { enabled: true } })}
          className="flex-1 rounded-md border border-outline-variant/70 bg-surface-container-lowest px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-surface-container-low"
        >
          Presentation
        </button>
      </div>
    </div>
  );
}
