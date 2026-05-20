import { supabase } from "@/integrations/supabase/client";
import type { ColetaComItens, ColetaInput } from "@/lib/data";
import { createColeta } from "@/lib/data";

export type AuditTipo =
  | "coleta_criada"
  | "coleta_editada"
  | "coleta_excluida"
  | "exclusao_em_massa"
  | "importacao"
  | "merge_destinador"
  | "merge_transportador"
  | "merge_unidade"
  | "merge_residuo"
  | "merge_tratamento"
  | "cadastro_criado"
  | "cadastro_editado"
  | "cadastro_excluido"
  | "vinculo_criado"
  | "dmr_upload"
  | "rollback";

export type AuditEntry = {
  id: string;
  unidade_id: string | null;
  tipo: AuditTipo;
  descricao: string;
  quantidade: number;
  snapshot: any;
  rollback_disponivel: boolean;
  revertido: boolean;
  criado_em: string;
};

export async function logAction(input: {
  unidade_id?: string | null;
  tipo: AuditTipo;
  descricao: string;
  quantidade?: number;
  snapshot?: any;
  rollback_disponivel?: boolean;
}): Promise<string | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("audit_log")
      .insert({
        unidade_id: input.unidade_id ?? null,
        tipo: input.tipo,
        descricao: input.descricao,
        quantidade: input.quantidade ?? 1,
        snapshot: input.snapshot ?? null,
        rollback_disponivel: input.rollback_disponivel ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    console.warn("audit log falhou", e);
    return null;
  }
}

export async function listAuditLog(unidade_id?: string | null, limit = 15): Promise<AuditEntry[]> {
  // Quando unidade_id for fornecido: últimas N daquela unidade.
  // Quando NÃO fornecido (todas): pega últimas 15 por unidade (incluindo entradas globais com unidade_id null) e mistura ordenadas por data.
  if (unidade_id) {
    const { data, error } = await (supabase as any)
      .from("audit_log")
      .select("*")
      .eq("unidade_id", unidade_id)
      .order("criado_em", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AuditEntry[];
  }

  // Buscar mais que o limite, particionar por unidade no cliente, manter 15 por partição
  const { data, error } = await (supabase as any)
    .from("audit_log")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(500);
  if (error) throw error;
  const all = (data ?? []) as AuditEntry[];
  const byUnit = new Map<string, AuditEntry[]>();
  for (const e of all) {
    const k = e.unidade_id ?? "__global__";
    if (!byUnit.has(k)) byUnit.set(k, []);
    const arr = byUnit.get(k)!;
    if (arr.length < limit) arr.push(e);
  }
  const merged: AuditEntry[] = [];
  byUnit.forEach((arr) => merged.push(...arr));
  merged.sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
  return merged;
}

export async function markRevertido(id: string) {
  await (supabase as any).from("audit_log").update({ revertido: true, rollback_disponivel: false }).eq("id", id);
}

// ===== Snapshot helpers =====
export function snapshotColeta(c: ColetaComItens): any {
  return {
    id: c.id,
    unidade_id: c.unidade_id,
    data: c.data,
    transportador: c.transportador,
    destinador: c.destinador,
    transportador_id: c.transportador_id,
    destinador_id: c.destinador_id,
    mtr: c.mtr,
    peso_estimado: c.peso_estimado,
    dmr_manual: c.dmr_manual,
    observacoes: c.observacoes,
    itens: (c.itens ?? []).map((it) => ({
      tipo_residuo_id: it.tipo_residuo_id,
      tipo_residuo_nome: it.tipo_residuo_nome,
      peso_kg: it.peso_kg,
      tratamento: it.tratamento,
    })),
  };
}

// Recria coletas a partir de snapshot (rollback de delete em massa OU de import)
export async function restoreColetasFromSnapshot(snap: any[]): Promise<number> {
  if (!Array.isArray(snap)) return 0;
  let n = 0;
  for (const s of snap) {
    const input: ColetaInput = {
      unidade_id: s.unidade_id,
      data: s.data,
      transportador: s.transportador,
      destinador: s.destinador,
      transportador_id: s.transportador_id,
      destinador_id: s.destinador_id,
      mtr: s.mtr,
      peso_estimado: !!s.peso_estimado,
      dmr_manual: !!s.dmr_manual,
      observacoes: s.observacoes,
      itens: s.itens ?? [],
    };
    await createColeta(input);
    n++;
  }
  return n;
}

// Para rollback de IMPORT: snapshot guarda os IDs criados; basta excluí-los.
export async function deleteColetasByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase.from("coletas").delete().in("id", ids);
  if (error) throw error;
  return ids.length;
}
