// CNPJ utilities: normalize, validate (official DV), format.

export function normalizeCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  return String(cnpj).replace(/\D/g, "");
}

export function isValidCNPJ(cnpj: string | null | undefined): boolean {
  const c = normalizeCNPJ(cnpj);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // sequência repetida

  const calc = (slice: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(slice[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(c.slice(0, 12), w1);
  const d2 = calc(c.slice(0, 12) + d1, w2);
  return d1 === Number(c[12]) && d2 === Number(c[13]);
}

export function formatCNPJ(cnpj: string | null | undefined): string {
  const c = normalizeCNPJ(cnpj);
  if (c.length !== 14) return cnpj ?? "";
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}
