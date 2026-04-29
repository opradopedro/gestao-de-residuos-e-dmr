import { supabase } from "@/integrations/supabase/client";

export type Unidade = { id: string; nome: string; criado_em: string };
export type TipoResiduo = { id: string; nome: string; tratamento_padrao: string; codigo?: string | null };
export type Tratamento = { id: string; nome: string; codigo: string | null };
export type Coleta = {
  id: string;
  unidade_id: string;
  data: string;
  transportador: string | null;
  destinador: string | null;
  transportador_id: string | null;
  destinador_id: string | null;
  mtr: string | null;
  peso_estimado: boolean;
  dmr_manual: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};
export type Transportador = { id: string; nome: string; cnpj: string | null };
export type Destinador = { id: string; nome: string; cnpj: string | null };
export type DestinadorResiduo = {
  id: string;
  destinador_id: string;
  tipo_residuo_id: string;
  tratamento: string;
};
export type ColetaItem = {
  id: string;
  coleta_id: string;
  tipo_residuo_id: string | null;
  tipo_residuo_nome: string;
  peso_kg: number;
  tratamento: string;
};
export type ColetaComItens = Coleta & { itens: ColetaItem[] };

export const ALERTA_PESO_KG = 50000;

export async function listUnidades(): Promise<Unidade[]> {
  const { data, error } = await supabase.from("unidades").select("*").order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function createUnidade(nome: string) {
  const { data, error } = await supabase.from("unidades").insert({ nome }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUnidade(id: string) {
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) throw error;
}

export async function listTiposResiduo(): Promise<TipoResiduo[]> {
  const { data, error } = await supabase.from("tipos_residuo").select("*").order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function upsertTipoResiduo(input: { id?: string; nome: string; tratamento_padrao: string; codigo?: string | null }) {
  const payload = { nome: input.nome, tratamento_padrao: input.tratamento_padrao, codigo: input.codigo ?? null };
  if (input.id) {
    const { error } = await supabase.from("tipos_residuo").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("tipos_residuo").insert(payload);
    if (error) throw error;
  }
}

export async function deleteTipoResiduo(id: string) {
  const { error } = await supabase.from("tipos_residuo").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkInsertTiposResiduo(rows: { nome: string; codigo?: string | null; tratamento_padrao?: string | null }[]) {
  const existentes = await listTiposResiduo();
  const existSet = new Set(existentes.map((t) => t.nome.toLowerCase()));
  const payload = rows
    .filter((r) => r.nome?.trim() && !existSet.has(r.nome.trim().toLowerCase()))
    .map((r) => ({ nome: r.nome.trim(), codigo: r.codigo?.trim() || null, tratamento_padrao: (r.tratamento_padrao?.trim() || "Reciclagem") }));
  if (payload.length === 0) return 0;
  const { error } = await supabase.from("tipos_residuo").insert(payload);
  if (error) throw error;
  return payload.length;
}

export async function listTratamentos(): Promise<Tratamento[]> {
  const { data, error } = await supabase.from("tratamentos").select("*").order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function upsertTratamento(input: { id?: string; nome: string; codigo?: string | null }) {
  const payload = { nome: input.nome, codigo: input.codigo ?? null };
  if (input.id) {
    const { error } = await supabase.from("tratamentos").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("tratamentos").insert(payload);
    if (error) throw error;
  }
}

export async function deleteTratamento(id: string) {
  const { error } = await supabase.from("tratamentos").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkInsertTratamentos(rows: { nome: string; codigo?: string | null }[]) {
  const existentes = await listTratamentos();
  const existSet = new Set(existentes.map((t) => t.nome.toLowerCase()));
  const payload = rows
    .filter((r) => r.nome?.trim() && !existSet.has(r.nome.trim().toLowerCase()))
    .map((r) => ({ nome: r.nome.trim(), codigo: r.codigo?.trim() || null }));
  if (payload.length === 0) return 0;
  const { error } = await supabase.from("tratamentos").insert(payload);
  if (error) throw error;
  return payload.length;
}

// ===== Transportadores =====
export async function listTransportadores(): Promise<Transportador[]> {
  const { data, error } = await supabase.from("transportadores").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as any;
}
export async function createTransportador(input: { nome: string; cnpj?: string | null }): Promise<Transportador> {
  const { data, error } = await supabase.from("transportadores").insert({ nome: input.nome, cnpj: input.cnpj ?? null }).select().single();
  if (error) throw error;
  return data as any;
}
export async function deleteTransportador(id: string) {
  const { error } = await supabase.from("transportadores").delete().eq("id", id);
  if (error) throw error;
}

// ===== Destinadores =====
export async function listDestinadores(): Promise<Destinador[]> {
  const { data, error } = await supabase.from("destinadores").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as any;
}
export async function createDestinador(input: { nome: string; cnpj?: string | null }): Promise<Destinador> {
  const { data, error } = await supabase.from("destinadores").insert({ nome: input.nome, cnpj: input.cnpj ?? null }).select().single();
  if (error) throw error;
  return data as any;
}
export async function deleteDestinador(id: string) {
  const { error } = await supabase.from("destinadores").delete().eq("id", id);
  if (error) throw error;
}

// ===== Vínculos destinador <-> resíduo =====
export async function listDestinadorResiduos(destinador_id?: string): Promise<DestinadorResiduo[]> {
  let q = supabase.from("destinador_residuos").select("*");
  if (destinador_id) q = q.eq("destinador_id", destinador_id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any;
}
export async function setDestinadorResiduos(destinador_id: string, vinculos: { tipo_residuo_id: string; tratamento: string }[]) {
  await supabase.from("destinador_residuos").delete().eq("destinador_id", destinador_id);
  if (vinculos.length === 0) return;
  const { error } = await supabase.from("destinador_residuos").insert(
    vinculos.map((v) => ({ destinador_id, tipo_residuo_id: v.tipo_residuo_id, tratamento: v.tratamento }))
  );
  if (error) throw error;
}
export async function addDestinadorResiduo(destinador_id: string, tipo_residuo_id: string, tratamento: string) {
  const { error } = await supabase.from("destinador_residuos").upsert(
    { destinador_id, tipo_residuo_id, tratamento },
    { onConflict: "destinador_id,tipo_residuo_id" }
  );
  if (error) throw error;
}

export type ColetaInput = {
  unidade_id: string;
  data: string;
  transportador?: string | null;
  destinador?: string | null;
  transportador_id?: string | null;
  destinador_id?: string | null;
  mtr?: string | null;
  peso_estimado: boolean;
  dmr_manual?: boolean;
  observacoes?: string | null;
  itens: { tipo_residuo_id: string | null; tipo_residuo_nome: string; peso_kg: number; tratamento: string }[];
};

function coletaPayload(input: ColetaInput) {
  return {
    unidade_id: input.unidade_id,
    data: input.data,
    transportador: input.transportador || null,
    destinador: input.destinador || null,
    transportador_id: input.transportador_id || null,
    destinador_id: input.destinador_id || null,
    mtr: input.dmr_manual ? null : (input.mtr || null),
    peso_estimado: input.peso_estimado,
    dmr_manual: !!input.dmr_manual,
    observacoes: input.observacoes || null,
  };
}

export async function createColeta(input: ColetaInput): Promise<string> {
  const { data: coleta, error } = await supabase
    .from("coletas")
    .insert(coletaPayload(input))
    .select()
    .single();
  if (error) throw error;
  if (input.itens.length > 0) {
    const { error: e2 } = await supabase.from("coleta_itens").insert(
      input.itens.map((it) => ({
        coleta_id: coleta.id,
        tipo_residuo_id: it.tipo_residuo_id,
        tipo_residuo_nome: it.tipo_residuo_nome,
        peso_kg: it.peso_kg,
        tratamento: it.tratamento,
      }))
    );
    if (e2) throw e2;
  }
  return coleta.id;
}

export async function updateColeta(id: string, input: ColetaInput) {
  const { error } = await supabase.from("coletas").update(coletaPayload(input)).eq("id", id);
  if (error) throw error;
  await supabase.from("coleta_itens").delete().eq("coleta_id", id);
  if (input.itens.length > 0) {
    const { error: e2 } = await supabase.from("coleta_itens").insert(
      input.itens.map((it) => ({
        coleta_id: id,
        tipo_residuo_id: it.tipo_residuo_id,
        tipo_residuo_nome: it.tipo_residuo_nome,
        peso_kg: it.peso_kg,
        tratamento: it.tratamento,
      }))
    );
    if (e2) throw e2;
  }
}

export async function deleteColeta(id: string) {
  const { error } = await supabase.from("coletas").delete().eq("id", id);
  if (error) throw error;
}

export async function getColeta(id: string): Promise<ColetaComItens | null> {
  const { data, error } = await supabase.from("coletas").select("*, itens:coleta_itens(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listColetasByUnidade(unidade_id: string): Promise<ColetaComItens[]> {
  const { data, error } = await supabase
    .from("coletas")
    .select("*, itens:coleta_itens(*)")
    .eq("unidade_id", unidade_id)
    .order("data", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function updateColetaMtr(id: string, mtr: string | null) {
  const { error } = await supabase.from("coletas").update({ mtr: mtr || null }).eq("id", id);
  if (error) throw error;
}

export async function confirmarPesoColeta(id: string) {
  const { error } = await supabase.from("coletas").update({ peso_estimado: false }).eq("id", id);
  if (error) throw error;
}

// Helpers para análises
export function totalPesoColeta(c: ColetaComItens): number {
  return (c.itens ?? []).reduce((s, it) => s + Number(it.peso_kg || 0), 0);
}

export function findMtrDuplicates(coletas: ColetaComItens[]): Set<string> {
  const counts = new Map<string, Set<string>>();
  for (const c of coletas) {
    if (!c.mtr) continue;
    if (!counts.has(c.mtr)) counts.set(c.mtr, new Set());
    counts.get(c.mtr)!.add(c.id);
  }
  const dup = new Set<string>();
  counts.forEach((ids, mtr) => {
    if (ids.size > 1) dup.add(mtr);
  });
  return dup;
}

// Item 8: contar metade das ocorrências de MTRs duplicados (excessos),
// pois 1 MTR repetido N vezes representa N-1 problemas reais.
export function countMtrDuplicatesExcess(coletas: ColetaComItens[]): number {
  const counts = new Map<string, number>();
  for (const c of coletas) {
    if (!c.mtr) continue;
    counts.set(c.mtr, (counts.get(c.mtr) ?? 0) + 1);
  }
  let n = 0;
  counts.forEach((v) => { if (v > 1) n += v - 1; });
  return n;
}

// Item 5: Sem MTR Tipo 1 (pendência real) = sem MTR e NÃO marcado como dmr_manual.
export function isPendenciaSemMtr(c: ColetaComItens): boolean {
  return !c.mtr && !c.dmr_manual;
}

// Importação em massa de coletas (item 11): cada grupo já vem agrupado.
export async function bulkInsertColetas(grupos: ColetaInput[]): Promise<number> {
  let n = 0;
  for (const g of grupos) {
    await createColeta(g);
    n++;
  }
  return n;
}

