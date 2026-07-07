"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/AuthShell";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      router.replace("/login");
    });
  }, [router]);

  return (
    <AuthShell title="Logging out" subtitle="Ending your Cadesca session.">
      <p className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3 text-label-md font-semibold text-primary">
        Please wait.
      </p>
    </AuthShell>
  );
}
