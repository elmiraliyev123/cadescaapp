import { MerchantShell } from "@/components/app/MerchantShell";

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <MerchantShell>{children}</MerchantShell>;
}
