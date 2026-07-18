import { UserShell } from "@/components/app/UserShell";

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return <UserShell>{children}</UserShell>;
}
