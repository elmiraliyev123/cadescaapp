import { UserShell } from "@/components/app/UserShell";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <UserShell>{children}</UserShell>;
}
