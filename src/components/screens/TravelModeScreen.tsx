import type { CountryRate } from "@/lib/types";
import { CountrySelector } from "@/components/forms/CountrySelector";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logo";
import { ScreenHeader } from "@/components/screens/ScreenHeader";

export function TravelModeScreen({
  countries,
  selectedCode,
  onSelect
}: {
  countries: CountryRate[];
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  const selected = countries.find((country) => country.code === selectedCode) ?? countries[0];

  return (
    <section>
      <ScreenHeader
        title="Travel Mode"
        description="CMU follows the employee across markets with a local meal value and approved partner network."
        action={<Badge tone="inverse">Cadesca Menu available</Badge>}
      />
      <CountrySelector countries={countries} selectedCode={selected.code} onSelect={onSelect} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="rounded-xl border border-primary bg-primary p-6 text-on-primary md:p-8">
          <div className="flex items-start justify-between gap-4">
            <Logo className="invert" />
            <span className="rounded-md border border-on-primary/20 bg-on-primary px-3 py-1 text-caption font-semibold text-primary">{selected.code}</span>
          </div>
          <div className="mt-16 max-w-2xl">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-inverse-primary">Local meal value</p>
            <h2 className="mt-3 text-[42px] font-bold leading-none tracking-[-0.02em] md:text-display">{selected.rate}</h2>
            <p className="mt-5 text-body-lg text-inverse-primary">
              In {selected.city}, one Cadesca Meal Unit maps to a local business lunch value of {selected.localValue}.
            </p>
          </div>
        </div>
        <div className="space-y-5">
          <div className="premium-card p-5">
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-secondary">Travel wallet preview</p>
            <p className="mt-4 text-headline-md font-semibold text-primary">{selected.walletPreview}</p>
            <p className="mt-2 text-body-md text-secondary">Borderless meal benefit without a new allowance workflow.</p>
          </div>
          <div className="premium-card p-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-headline-md font-semibold text-primary">Partner restaurants</h2>
              <Badge>{selected.city}</Badge>
            </div>
            <div className="divide-y divide-outline-variant/70">
              {selected.partners.map((partner) => (
                <div key={partner} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/70 bg-surface-container-low">
                      <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">restaurant</span>
                    </div>
                    <span className="text-label-md font-semibold text-primary">{partner}</span>
                  </div>
                  <span className="text-caption font-semibold text-secondary">1 CMU</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
