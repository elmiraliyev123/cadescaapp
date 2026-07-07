import type { CountryRate } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CountryCard({
  country,
  selected,
  onSelect
}: {
  country: CountryRate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-[118px] flex-col justify-between rounded-xl border p-4 text-left transition-colors",
        selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant/70 bg-surface-container-lowest text-primary hover:bg-surface-container-low"
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-caption font-semibold uppercase tracking-[0.08em]">{country.code}</span>
        <span className={cn("h-2 w-2 rounded-full", selected ? "bg-on-primary" : "bg-primary")} />
      </span>
      <span>
        <span className="block text-label-md font-semibold">{country.country}</span>
        <span className={cn("mt-1 block text-caption font-medium", selected ? "text-inverse-primary" : "text-secondary")}>{country.rate}</span>
      </span>
    </button>
  );
}

export function CountrySelector({
  countries,
  selectedCode,
  onSelect
}: {
  countries: CountryRate[];
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {countries.map((country) => {
        const selected = country.code === selectedCode;
        return (
          <CountryCard
            key={country.code}
            country={country}
            selected={selected}
            onSelect={() => onSelect(country.code)}
          />
        );
      })}
    </div>
  );
}
