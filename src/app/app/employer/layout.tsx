import { EmployerShell } from "@/components/app/EmployerShell";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return <EmployerShell>{children}</EmployerShell>;
}
