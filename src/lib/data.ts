import { supabase } from "@/integrations/supabase/client";

export type Unidade = { id: string; nome: string; criado_em: string };
export type TipoResiduo = { id: string; nome: string; tratamento_padrao: string };
export type Coleta = {
  id: string;
  unidade_id: string;
  data: string;
  transportador: string | null;
  destinador: string | null;
  mtr: string | null;
  peso_estimado: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
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

export async function upsertTipoResiduo(input: { id?: string; nome: string; tratamento_padrao: string }) {
  if (input.id) {
    const { error } = await supabase.from("tipos_residuo").update({ nome: input.nome, tratamento_padrao: input.tratamento_padrao }).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("tipos_residuo").insert({ nome: input.nome, tratamento_padrao: input.tratamento_padrao });
    if (error) throw error;
  }
}

export async function deleteTipoResiduo(id: string) {
  const { error } = await supabase.from("tipos_residuo").delete().eq("id", id);
  if (error) throw error;
}

export type ColetaInput = {
  unidade_id: string;
  data: string;
  transportador?: string | null;
  destinador?: string | null;
  mtr?: string | null;
  peso_estimado: boolean;
  observacoes?: string | null;
  itens: { tipo_residuo_id: string | null; tipo_residuo_nome: string; peso_kg: number; tratamento: string }[];
};

export async function createColeta(input: ColetaInput): Promise<string> {
  const { data: coleta, error } = await supabase
    .from("coletas")
    .insert({
      unidade_id: input.unidade_id,
      data: input.data,
      transportador: input.transportador || null,
      destinador: input.destinador || null,
      mtr: input.mtr || null,
      peso_estimado: input.peso_estimado,
      observacoes: input.observacoes || null,
    })
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
  const { error } = await supabase
    .from("coletas")
    .update({
      unidade_id: input.unidade_id,
      data: input.data,
      transportador: input.transportador || null,
      destinador: input.destinador || null,
      mtr: input.mtr || null,
      peso_estimado: input.peso_estimado,
      observacoes: input.observacoes || null,
    })
    .eq("id", id);
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
