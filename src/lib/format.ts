export function formatKg(kg: number): string {
  if (!isFinite(kg)) return "0 kg";
  if (Math.abs(kg) >= 1000) return `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

export function formatTon(kg: number): string {
  return `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
