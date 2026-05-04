import type { ColetaComItens } from "@/lib/data";
import { totalPesoColeta } from "@/lib/data";

export type FiltroCampo =
  | "data"
  | "mtr"
  | "residuo"
  | "destinador"
  | "transportador"
  | "peso"
  | "observacoes"
  | "unidade"
  | "status";

export type FiltroOperador =
  | "igual"
  | "contem"
  | "comeca"
  | "maior"
  | "menor"
  | "entre"
  | "vazio"
  | "nao_vazio";

export type FiltroRegra = {
  id: string;
  campo: FiltroCampo;
  operador: FiltroOperador;
  valor?: string;
  valor2?: string; // usado em "entre"
};

export type FiltroAvancado = {
  combinador: "AND" | "OR";
  regras: FiltroRegra[];
};

export const CAMPOS: { v: FiltroCampo; l: string; tipo: "text" | "number" | "date" | "select" }[] = [
  { v: "data", l: "Data", tipo: "date" },
  { v: "mtr", l: "MTR", tipo: "text" },
  { v: "residuo", l: "Resíduo", tipo: "text" },
  { v: "destinador", l: "Destinador", tipo: "text" },
  { v: "transportador", l: "Transportador", tipo: "text" },
  { v: "peso", l: "Peso (kg)", tipo: "number" },
  { v: "observacoes", l: "Observações", tipo: "text" },
  { v: "unidade", l: "Unidade", tipo: "text" },
  { v: "status", l: "Status", tipo: "select" },
];

export const OPERADORES: Record<string, FiltroOperador[]> = {
  text: ["igual", "contem", "comeca", "vazio", "nao_vazio"],
  number: ["igual", "maior", "menor", "entre", "vazio", "nao_vazio"],
  date: ["igual", "maior", "menor", "entre"],
  select: ["igual"],
};

export const OP_LABEL: Record<FiltroOperador, string> = {
  igual: "é igual a",
  contem: "contém",
  comeca: "começa com",
  maior: "maior que",
  menor: "menor que",
  entre: "entre",
  vazio: "está vazio",
  nao_vazio: "não está vazio",
};

function getCampoValor(c: ColetaComItens, campo: FiltroCampo, unidadeNome?: string): string | number | null {
  switch (campo) {
    case "data": return c.data;
    case "mtr": return c.mtr ?? "";
    case "residuo": return (c.itens ?? []).map((it) => it.tipo_residuo_nome).join(" | ");
    case "destinador": return c.destinador ?? "";
    case "transportador": return c.transportador ?? "";
    case "peso": return totalPesoColeta(c);
    case "observacoes": return c.observacoes ?? "";
    case "unidade": return unidadeNome ?? c.unidade_id;
    case "status": {
      if (!c.mtr && !c.dmr_manual) return "sem_mtr";
      if (c.dmr_manual) return "dmr_manual";
      if (c.peso_estimado) return "peso_estimado";
      if (totalPesoColeta(c) === 0) return "sem_peso";
      return "ok";
    }
  }
}

function testRegra(c: ColetaComItens, r: FiltroRegra, unidadeNome?: string): boolean {
  const raw = getCampoValor(c, r.campo, unidadeNome);
  if (r.operador === "vazio") return raw === "" || raw === null || raw === 0;
  if (r.operador === "nao_vazio") return !(raw === "" || raw === null || raw === 0);
  if (r.valor === undefined || r.valor === "") return true;
  const v = String(raw ?? "").toLowerCase();
  const q = r.valor.toLowerCase();
  switch (r.operador) {
    case "igual": return v === q;
    case "contem": return v.includes(q);
    case "comeca": return v.startsWith(q);
    case "maior": {
      if (r.campo === "data") return String(raw) > r.valor;
      return Number(raw) > Number(r.valor);
    }
    case "menor": {
      if (r.campo === "data") return String(raw) < r.valor;
      return Number(raw) < Number(r.valor);
    }
    case "entre": {
      const a = r.valor, b = r.valor2 ?? "";
      if (r.campo === "data") return String(raw) >= a && String(raw) <= b;
      const n = Number(raw);
      return n >= Number(a) && n <= Number(b);
    }
    default: return true;
  }
}

export function aplicarFiltro(
  coletas: ColetaComItens[],
  filtro: FiltroAvancado | null,
  unidadeNomes?: Record<string, string>,
): ColetaComItens[] {
  if (!filtro || filtro.regras.length === 0) return coletas;
  return coletas.filter((c) => {
    const u = unidadeNomes?.[c.unidade_id];
    const results = filtro.regras.map((r) => testRegra(c, r, u));
    return filtro.combinador === "AND" ? results.every(Boolean) : results.some(Boolean);
  });
}
