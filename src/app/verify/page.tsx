import { Logo } from "@/components/ui/Logo";
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata";

export const metadata = PRIVATE_ROUTE_METADATA;

export default function VerifyQrFallbackPage() {
  return (
    <main className="min-h-screen bg-surface-container-lowest px-5 py-8 text-primary">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col items-center justify-center text-center">
        <Logo maxWidth={150} />
        <div className="mt-8 premium-card w-full p-6">
          <p className="text-headline-md font-semibold text-primary">Cadesca QR verification</p>
          <p className="mt-3 text-body-md text-secondary">
            This QR can only be verified by an authenticated Cadesca merchant.
          </p>
          <p className="mt-3 text-body-md text-secondary">
            Bu QR yalnız Cadesca merchant tərəfindən yoxlana bilər.
          </p>
          <p className="mt-3 text-body-md text-secondary">
            Этот QR-код может быть проверен только merchant Cadesca.
          </p>
          <p className="mt-3 text-body-md text-secondary">
            No student data is displayed on this public page.
          </p>
        </div>
      </section>
    </main>
  );
}
