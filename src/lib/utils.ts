export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatAzn(value: number) {
  return `${value.toFixed(2)} AZN`;
}

export function formatMoney(value: number, currency = "AZN") {
  return `${value.toFixed(2)} ${currency}`;
}

export function formatCmu(value: number) {
  return `${value} CMU`;
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function canPayWithCmu(cmuBalance: number, cost = 1) {
  return cmuBalance >= cost;
}

export function canPayWithAzn(aznBalance: number, cost: number) {
  return aznBalance >= cost;
}

export function canPaySplit(cmuBalance: number, aznBalance: number, aznCost: number, cmuCost = 1) {
  return cmuBalance >= cmuCost && aznBalance >= aznCost;
}
