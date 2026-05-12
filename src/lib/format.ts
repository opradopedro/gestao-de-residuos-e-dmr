export function formatKg(kg: number): string {
  if (!isFinite(kg)) return "0 kg";
  if (Math.abs(kg) >= 1000) return `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

// Sempre em kg, sem conversão automática para tonelada (Fase 2 — tabela de coletas)
export function formatKgPlain(kg: number): string {
  if (!isFinite(kg)) return "0 kg";
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
}

export function formatTon(kg: number): string {
  return `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Converte um valor de planilha (que representa TONELADAS) em número.
// Aceita: número JS (xlsx já parseou), string com vírgula decimal (BR) ou ponto (EN).
// NÃO remove pontos cegamente (bug anterior multiplicava 2.7 por 10).
export function parseTonelada(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  // remove espaços e símbolos de unidade
  s = s.replace(/\s+/g, "").replace(/t(on(eladas?)?)?$/i, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // formato BR: "1.234,56" -> remove pontos (milhar), troca vírgula por ponto
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // só vírgula -> decimal BR
    s = s.replace(",", ".");
  }
  // só ponto OU sem separador -> mantém (ponto é decimal padrão)
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
