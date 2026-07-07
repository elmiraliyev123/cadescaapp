import { EmployeeShell } from "@/components/app/EmployeeShell";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeShell>{children}</EmployeeShell>;
}
