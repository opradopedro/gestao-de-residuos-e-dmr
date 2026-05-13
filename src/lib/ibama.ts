// Código IBAMA: 6 dígitos + opcional asterisco (perigoso).
// Aceita variações: "16 10 01*", "161001", "150202(*)", "150202 *".

export function normalizeCodigoIbama(s: string | null | undefined): string {
  if (!s) return "";
  const raw = String(s);
  const hasStar = /\*|\(\*\)/.test(raw);
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return hasStar ? "*" : "";
  return hasStar ? `${digits}*` : digits;
}

// Formato legível: "## ## ##" (+ "*" se perigoso). Exige 6 dígitos.
export function formatCodigoIbama(s: string | null | undefined): string {
  if (!s) return "";
  const norm = normalizeCodigoIbama(s);
  const star = norm.endsWith("*") ? "*" : "";
  const digits = norm.replace(/\D/g, "");
  if (digits.length !== 6) return s ?? "";
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}${star}`;
}

// Compara dois códigos ignorando espaços / parênteses; ignora asterisco se um lado não tiver.
export function ibamaCodigoMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = (a ?? "").replace(/\D/g, "");
  const db = (b ?? "").replace(/\D/g, "");
  if (!da || !db) return false;
  return da === db;
}
