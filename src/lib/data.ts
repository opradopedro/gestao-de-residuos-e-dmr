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

export async function bulkInsertUnidades(rows: { nome: string }[]) {
  const valid = rows.filter((r) => r.nome?.trim());
  if (valid.length === 0) return 0;
  const { error } = await supabase.from("unidades").insert(valid);
  if (error) throw error;
  return valid.length;
}

export async function bulkInsertTransportadores(rows: { nome: string; cnpj?: string | null }[]) {
  const valid = rows.filter((r) => r.nome?.trim()).map((r) => ({ nome: r.nome.trim(), cnpj: r.cnpj?.trim() || null }));
  if (valid.length === 0) return 0;
  const { error } = await supabase.from("transportadores").insert(valid);
  if (error) throw error;
  return valid.length;
}

export async function bulkInsertDestinadores(rows: { nome: string; cnpj?: string | null }[]) {
  const valid = rows.filter((r) => r.nome?.trim()).map((r) => ({ nome: r.nome.trim(), cnpj: r.cnpj?.trim() || null }));
  if (valid.length === 0) return 0;
  const { error } = await supabase.from("destinadores").insert(valid);
  if (error) throw error;
  return valid.length;
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

export async function upsertTipoResiduo(input: { id?: string; nome: string; tratamento_padrao: string; codigo?: string | null }): Promise<TipoResiduo> {
  const payload = { nome: input.nome, tratamento_padrao: input.tratamento_padrao, codigo: input.codigo ?? null };
  if (input.id) {
    // cascade rename: propaga novo nome para itens de coleta vinculados por id
    const { data: prev } = await supabase.from("tipos_residuo").select("nome").eq("id", input.id).maybeSingle();
    const { data, error } = await supabase.from("tipos_residuo").update(payload).eq("id", input.id).select().single();
    if (error) throw error;
    if (prev && (prev as any).nome !== input.nome) {
      await supabase.from("coleta_itens").update({ tipo_residuo_nome: input.nome }).eq("tipo_residuo_id", input.id);
    }
    return data as any;
  } else {
    const { data, error } = await supabase.from("tipos_residuo").insert(payload).select().single();
    if (error) throw error;
    return data as any;
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

export async function upsertTratamento(input: { id?: string; nome: string; codigo?: string | null }): Promise<Tratamento> {
  const payload = { nome: input.nome, codigo: input.codigo ?? null };
  if (input.id) {
    // cascade rename: propaga em coleta_itens.tratamento, tipos_residuo.tratamento_padrao, destinador_residuos.tratamento
    const { data: prev } = await supabase.from("tratamentos").select("nome").eq("id", input.id).maybeSingle();
    const { data, error } = await supabase.from("tratamentos").update(payload).eq("id", input.id).select().single();
    if (error) throw error;
    const oldNome = (prev as any)?.nome;
    if (oldNome && oldNome !== input.nome) {
      await supabase.from("coleta_itens").update({ tratamento: input.nome }).eq("tratamento", oldNome);
      await supabase.from("tipos_residuo").update({ tratamento_padrao: input.nome }).eq("tratamento_padrao", oldNome);
      await supabase.from("destinador_residuos").update({ tratamento: input.nome }).eq("tratamento", oldNome);
    }
    return data as any;
  } else {
    const { data, error } = await supabase.from("tratamentos").insert(payload).select().single();
    if (error) throw error;
    return data as any;
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
function onlyDigits(s?: string | null) { return (s ?? "").replace(/\D+/g, ""); }
export async function findTransportadorByCnpj(cnpj: string): Promise<Transportador | null> {
  const d = onlyDigits(cnpj);
  if (!d) return null;
  const all = await listTransportadores();
  return all.find((t) => onlyDigits(t.cnpj) === d) ?? null;
}
export async function findDestinadorByCnpj(cnpj: string): Promise<Destinador | null> {
  const d = onlyDigits(cnpj);
  if (!d) return null;
  const all = await listDestinadores();
  return all.find((t) => onlyDigits(t.cnpj) === d) ?? null;
}
export async function createTransportador(input: { nome: string; cnpj?: string | null }): Promise<Transportador> {
  if (input.cnpj) {
    const dup = await findTransportadorByCnpj(input.cnpj);
    if (dup) { const e: any = new Error(`CNPJ já cadastrado para "${dup.nome}"`); e.code = "DUP_CNPJ"; e.existing = dup; throw e; }
  }
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
  if (input.cnpj) {
    const dup = await findDestinadorByCnpj(input.cnpj);
    if (dup) { const e: any = new Error(`CNPJ já cadastrado para "${dup.nome}"`); e.code = "DUP_CNPJ"; e.existing = dup; throw e; }
  }
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

async function autoLinkResiduosDestinador(input: ColetaInput): Promise<string[]> {
  if (!input.destinador_id) return [];
  const itensComId = input.itens.filter((i) => i.tipo_residuo_id);
  if (itensComId.length === 0) return [];
  const ids = Array.from(new Set(itensComId.map((i) => i.tipo_residuo_id!)));
  const { data: existentes } = await supabase
    .from("destinador_residuos")
    .select("tipo_residuo_id")
    .eq("destinador_id", input.destinador_id)
    .in("tipo_residuo_id", ids);
  const ja = new Set((existentes ?? []).map((r: any) => r.tipo_residuo_id));
  const novos: string[] = [];
  for (const it of itensComId) {
    if (ja.has(it.tipo_residuo_id!)) continue;
    await supabase.from("destinador_residuos").upsert(
      { destinador_id: input.destinador_id as string, tipo_residuo_id: it.tipo_residuo_id as string, tratamento: it.tratamento || "Reciclagem" },
      { onConflict: "destinador_id,tipo_residuo_id" }
    );
    ja.add(it.tipo_residuo_id!);
    novos.push(it.tipo_residuo_nome);
  }
  return novos;
}

export async function createColeta(input: ColetaInput, opts?: { skipAudit?: boolean }): Promise<string> {
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
  const novosVinculos = await autoLinkResiduosDestinador(input);
  if (!opts?.skipAudit) {
    const { logAction } = await import("@/lib/audit");
    await logAction({
      unidade_id: input.unidade_id,
      tipo: "coleta_criada",
      descricao: `Coleta criada${input.mtr ? ` (MTR ${input.mtr})` : ""}`,
      quantidade: 1,
    });
  }
  if (novosVinculos.length > 0) {
    try {
      const { toast } = await import("sonner");
      toast.info(`Vinculado ao destinador: ${novosVinculos.join(", ")}`);
    } catch {}
  }
  return coleta.id;
}

export async function updateColeta(id: string, input: ColetaInput, opts?: { skipAudit?: boolean }) {
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
  const novosVinculos = await autoLinkResiduosDestinador(input);
  if (!opts?.skipAudit) {
    const { logAction } = await import("@/lib/audit");
    await logAction({
      unidade_id: input.unidade_id,
      tipo: "coleta_editada",
      descricao: `Coleta editada${input.mtr ? ` (MTR ${input.mtr})` : ""}`,
      quantidade: 1,
    });
  }
  if (novosVinculos.length > 0) {
    try {
      const { toast } = await import("sonner");
      toast.info(`Vinculado ao destinador: ${novosVinculos.join(", ")}`);
    } catch {}
  }
}

export async function deleteColeta(id: string, opts?: { skipAudit?: boolean }) {
  let snap: any = null;
  let unidadeId: string | null = null;
  if (!opts?.skipAudit) {
    const c = await getColeta(id);
    if (c) {
      const { snapshotColeta } = await import("@/lib/audit");
      snap = snapshotColeta(c);
      unidadeId = c.unidade_id;
    }
  }
  const { error } = await supabase.from("coletas").delete().eq("id", id);
  if (error) throw error;
  if (!opts?.skipAudit) {
    const { logAction } = await import("@/lib/audit");
    await logAction({
      unidade_id: unidadeId,
      tipo: "coleta_excluida",
      descricao: `Coleta excluída${snap?.mtr ? ` (MTR ${snap.mtr})` : ""}`,
      quantidade: 1,
      snapshot: snap ? [snap] : null,
      rollback_disponivel: !!snap,
    });
  }
}

// Exclusão em massa: registra UM evento com snapshot de todas as coletas para rollback.
export async function bulkDeleteColetas(ids: string[], unidade_id: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  const { snapshotColeta, logAction } = await import("@/lib/audit");
  // Buscar snapshots completos
  const { data: rows, error: e1 } = await supabase
    .from("coletas")
    .select("*, itens:coleta_itens(*)")
    .in("id", ids);
  if (e1) throw e1;
  const snaps = (rows ?? []).map((c: any) => snapshotColeta(c as ColetaComItens));
  const { error } = await supabase.from("coletas").delete().in("id", ids);
  if (error) throw error;
  await logAction({
    unidade_id,
    tipo: "exclusao_em_massa",
    descricao: `Exclusão em massa de ${snaps.length} coleta(s)`,
    quantidade: snaps.length,
    snapshot: snaps,
    rollback_disponivel: true,
  });
  return snaps.length;
}

// ===== Anos com dados =====
export async function listAnosComColetas(): Promise<number[]> {
  const { data, error } = await supabase.from("coletas").select("data").order("data", { ascending: false }).limit(5000);
  if (error) throw error;
  const anos = new Set<number>();
  for (const r of data ?? []) {
    const y = (r as any).data?.slice(0, 4);
    if (y) anos.add(Number(y));
  }
  if (anos.size === 0) anos.add(new Date().getFullYear());
  return Array.from(anos).sort((a, b) => a - b);
}

// ===== Merge =====
export async function mergeDestinadores(manterId: string, removerId: string): Promise<{ coletasAtualizadas: number; vinculosTransferidos: number }> {
  const { logAction } = await import("@/lib/audit");
  const { data: manter } = await supabase.from("destinadores").select("*").eq("id", manterId).single();
  const { data: remover } = await supabase.from("destinadores").select("*").eq("id", removerId).single();
  const { data: coletasAfetadas } = await supabase.from("coletas").select("id").eq("destinador_id", removerId);
  const idsAfetadas = (coletasAfetadas ?? []).map((c: any) => c.id);
  const { data: vincRemoverFull } = await supabase.from("destinador_residuos").select("*").eq("destinador_id", removerId);
  if (idsAfetadas.length > 0) {
    await supabase.from("coletas").update({ destinador_id: manterId, destinador: manter?.nome ?? null }).in("id", idsAfetadas);
  }
  const { data: vincManter } = await supabase.from("destinador_residuos").select("tipo_residuo_id").eq("destinador_id", manterId);
  const existSet = new Set((vincManter ?? []).map((v: any) => v.tipo_residuo_id));
  let transferidos = 0;
  for (const v of vincRemoverFull ?? []) {
    if (!existSet.has((v as any).tipo_residuo_id)) {
      await supabase.from("destinador_residuos").insert({
        destinador_id: manterId,
        tipo_residuo_id: (v as any).tipo_residuo_id,
        tratamento: (v as any).tratamento,
      });
      transferidos++;
    }
  }
  await supabase.from("destinador_residuos").delete().eq("destinador_id", removerId);
  await supabase.from("destinadores").delete().eq("id", removerId);
  await logAction({
    tipo: "merge_destinador",
    descricao: `Merge: "${remover?.nome}" → "${manter?.nome}" (${idsAfetadas.length} coletas, ${transferidos} vínculos novos)`,
    quantidade: idsAfetadas.length,
    snapshot: { kind: "merge_destinador", removido: remover, manterId, vinculos: vincRemoverFull ?? [], coletasAfetadas: idsAfetadas },
    rollback_disponivel: true,
  });
  return { coletasAtualizadas: idsAfetadas.length, vinculosTransferidos: transferidos };
}

export async function mergeTransportadores(manterId: string, removerId: string): Promise<{ coletasAtualizadas: number }> {
  const { logAction } = await import("@/lib/audit");
  const { data: manter } = await supabase.from("transportadores").select("*").eq("id", manterId).single();
  const { data: remover } = await supabase.from("transportadores").select("*").eq("id", removerId).single();
  const { data: coletasAfetadas } = await supabase.from("coletas").select("id").eq("transportador_id", removerId);
  const idsAfetadas = (coletasAfetadas ?? []).map((c: any) => c.id);
  if (idsAfetadas.length > 0) {
    await supabase.from("coletas").update({ transportador_id: manterId, transportador: manter?.nome ?? null }).in("id", idsAfetadas);
  }
  await supabase.from("transportadores").delete().eq("id", removerId);
  await logAction({
    tipo: "merge_transportador",
    descricao: `Merge: "${remover?.nome}" → "${manter?.nome}" (${idsAfetadas.length} coletas)`,
    quantidade: idsAfetadas.length,
    snapshot: { kind: "merge_transportador", removido: remover, manterId, coletasAfetadas: idsAfetadas },
    rollback_disponivel: true,
  });
  return { coletasAtualizadas: idsAfetadas.length };
}

export async function mergeUnidades(manterId: string, removerId: string): Promise<{ coletasAtualizadas: number }> {
  const { logAction } = await import("@/lib/audit");
  const { data: manter } = await supabase.from("unidades").select("*").eq("id", manterId).single();
  const { data: remover } = await supabase.from("unidades").select("*").eq("id", removerId).single();
  const { data: afet } = await supabase.from("coletas").select("id").eq("unidade_id", removerId);
  const ids = (afet ?? []).map((c: any) => c.id);
  if (ids.length > 0) await supabase.from("coletas").update({ unidade_id: manterId }).in("id", ids);
  await supabase.from("unidades").delete().eq("id", removerId);
  await logAction({
    tipo: "merge_unidade" as any,
    descricao: `Merge unidade: "${remover?.nome}" → "${manter?.nome}" (${ids.length} coletas)`,
    quantidade: ids.length,
    snapshot: { kind: "merge_unidade", removido: remover, coletasAfetadas: ids },
    rollback_disponivel: true,
  });
  return { coletasAtualizadas: ids.length };
}

export async function mergeTiposResiduo(manterId: string, removerId: string): Promise<{ itensAtualizados: number }> {
  const { logAction } = await import("@/lib/audit");
  const { data: manter } = await supabase.from("tipos_residuo").select("*").eq("id", manterId).single();
  const { data: remover } = await supabase.from("tipos_residuo").select("*").eq("id", removerId).single();
  const { data: afet } = await supabase.from("coleta_itens").select("id").eq("tipo_residuo_id", removerId);
  const ids = (afet ?? []).map((c: any) => c.id);
  if (ids.length > 0) await supabase.from("coleta_itens").update({ tipo_residuo_id: manterId, tipo_residuo_nome: manter?.nome ?? undefined }).in("id", ids);
  const { data: destManterRows } = await supabase.from("destinador_residuos").select("destinador_id").eq("tipo_residuo_id", manterId);
  const setDest = new Set((destManterRows ?? []).map((r: any) => r.destinador_id));
  const { data: destRem } = await supabase.from("destinador_residuos").select("*").eq("tipo_residuo_id", removerId);
  for (const v of destRem ?? []) {
    if (!setDest.has((v as any).destinador_id)) {
      await supabase.from("destinador_residuos").insert({ destinador_id: (v as any).destinador_id, tipo_residuo_id: manterId, tratamento: (v as any).tratamento });
    }
  }
  await supabase.from("destinador_residuos").delete().eq("tipo_residuo_id", removerId);
  await supabase.from("tipos_residuo").delete().eq("id", removerId);
  await logAction({
    tipo: "merge_residuo" as any,
    descricao: `Merge resíduo: "${remover?.nome}" → "${manter?.nome}" (${ids.length} itens)`,
    quantidade: ids.length,
    snapshot: { kind: "merge_residuo", removido: remover, vinculos: destRem ?? [], itensAfetados: ids },
    rollback_disponivel: true,
  });
  return { itensAtualizados: ids.length };
}

export async function mergeTratamentos(manterId: string, removerId: string): Promise<{ ok: boolean }> {
  const { logAction } = await import("@/lib/audit");
  const { data: manter } = await supabase.from("tratamentos").select("*").eq("id", manterId).single();
  const { data: remover } = await supabase.from("tratamentos").select("*").eq("id", removerId).single();
  let itensIds: string[] = [];
  let tiposIds: string[] = [];
  let vincIds: string[] = [];
  if (remover?.nome && manter?.nome) {
    const { data: i1 } = await supabase.from("coleta_itens").select("id").eq("tratamento", remover.nome);
    itensIds = (i1 ?? []).map((r: any) => r.id);
    const { data: i2 } = await supabase.from("tipos_residuo").select("id").eq("tratamento_padrao", remover.nome);
    tiposIds = (i2 ?? []).map((r: any) => r.id);
    const { data: i3 } = await supabase.from("destinador_residuos").select("id").eq("tratamento", remover.nome);
    vincIds = (i3 ?? []).map((r: any) => r.id);
    if (itensIds.length > 0) await supabase.from("coleta_itens").update({ tratamento: manter.nome }).in("id", itensIds);
    if (tiposIds.length > 0) await supabase.from("tipos_residuo").update({ tratamento_padrao: manter.nome }).in("id", tiposIds);
    if (vincIds.length > 0) await supabase.from("destinador_residuos").update({ tratamento: manter.nome }).in("id", vincIds);
  }
  await supabase.from("tratamentos").delete().eq("id", removerId);
  await logAction({
    tipo: "merge_tratamento" as any,
    descricao: `Merge tratamento: "${remover?.nome}" → "${manter?.nome}"`,
    quantidade: 1,
    snapshot: { kind: "merge_tratamento", removido: remover, manterNome: manter?.nome, itensIds, tiposIds, vincIds },
    rollback_disponivel: true,
  });
  return { ok: true };
}

// ===== Rollback de merges =====
export async function rollbackMerge(snap: any): Promise<number> {
  if (!snap || typeof snap !== "object") return 0;
  const k = snap.kind;
  if (k === "merge_destinador") {
    const r = snap.removido;
    await supabase.from("destinadores").insert({ id: r.id, nome: r.nome, cnpj: r.cnpj });
    for (const v of snap.vinculos ?? []) {
      await supabase.from("destinador_residuos").insert({ id: v.id, destinador_id: r.id, tipo_residuo_id: v.tipo_residuo_id, tratamento: v.tratamento });
    }
    if ((snap.coletasAfetadas ?? []).length > 0) {
      await supabase.from("coletas").update({ destinador_id: r.id, destinador: r.nome }).in("id", snap.coletasAfetadas);
    }
    return (snap.coletasAfetadas ?? []).length;
  }
  if (k === "merge_transportador") {
    const r = snap.removido;
    await supabase.from("transportadores").insert({ id: r.id, nome: r.nome, cnpj: r.cnpj });
    if ((snap.coletasAfetadas ?? []).length > 0) {
      await supabase.from("coletas").update({ transportador_id: r.id, transportador: r.nome }).in("id", snap.coletasAfetadas);
    }
    return (snap.coletasAfetadas ?? []).length;
  }
  if (k === "merge_unidade") {
    const r = snap.removido;
    await supabase.from("unidades").insert({ id: r.id, nome: r.nome });
    if ((snap.coletasAfetadas ?? []).length > 0) {
      await supabase.from("coletas").update({ unidade_id: r.id }).in("id", snap.coletasAfetadas);
    }
    return (snap.coletasAfetadas ?? []).length;
  }
  if (k === "merge_residuo") {
    const r = snap.removido;
    await supabase.from("tipos_residuo").insert({ id: r.id, nome: r.nome, codigo: r.codigo, tratamento_padrao: r.tratamento_padrao });
    for (const v of snap.vinculos ?? []) {
      await supabase.from("destinador_residuos").insert({ id: v.id, destinador_id: v.destinador_id, tipo_residuo_id: r.id, tratamento: v.tratamento });
    }
    if ((snap.itensAfetados ?? []).length > 0) {
      await supabase.from("coleta_itens").update({ tipo_residuo_id: r.id, tipo_residuo_nome: r.nome }).in("id", snap.itensAfetados);
    }
    return (snap.itensAfetados ?? []).length;
  }
  if (k === "merge_tratamento") {
    const r = snap.removido;
    await supabase.from("tratamentos").insert({ id: r.id, nome: r.nome, codigo: r.codigo });
    if ((snap.itensIds ?? []).length > 0) await supabase.from("coleta_itens").update({ tratamento: r.nome }).in("id", snap.itensIds);
    if ((snap.tiposIds ?? []).length > 0) await supabase.from("tipos_residuo").update({ tratamento_padrao: r.nome }).in("id", snap.tiposIds);
    if ((snap.vincIds ?? []).length > 0) await supabase.from("destinador_residuos").update({ tratamento: r.nome }).in("id", snap.vincIds);
    return 1;
  }
  return 0;
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

export async function listAllColetas(): Promise<ColetaComItens[]> {
  const { data, error } = await supabase
    .from("coletas")
    .select("*, itens:coleta_itens(*)")
    .order("data", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function updateColetaMtr(id: string, mtr: string | null) {
  const { error } = await supabase.from("coletas").update({ mtr: mtr || null }).eq("id", id);
  if (error) throw error;
}

// ===== Atualizações de cadastros =====
export async function updateUnidade(id: string, nome: string): Promise<Unidade> {
  const { data, error } = await supabase.from("unidades").update({ nome }).eq("id", id).select().single();
  if (error) throw error;
  return data as any;
}
export async function updateTransportador(id: string, input: { nome: string; cnpj?: string | null }): Promise<Transportador> {
  const { data, error } = await supabase.from("transportadores").update({ nome: input.nome, cnpj: input.cnpj ?? null }).eq("id", id).select().single();
  if (error) throw error;
  return data as any;
}
export async function updateDestinador(id: string, input: { nome: string; cnpj?: string | null }): Promise<Destinador> {
  const { data, error } = await supabase.from("destinadores").update({ nome: input.nome, cnpj: input.cnpj ?? null }).eq("id", id).select().single();
  if (error) throw error;
  return data as any;
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

// Item 5: Sem MTR por erro = sem MTR e NÃO marcado como dmr_manual.
export function isPendenciaSemMtr(c: ColetaComItens): boolean {
  return !c.mtr && !c.dmr_manual;
}

// Sem MTR por operação (DMR manual) — informativo, não é pendência.
export function isSemMtrOperacao(c: ColetaComItens): boolean {
  return !c.mtr && !!c.dmr_manual;
}

// Coleta sem peso (qualquer): total = 0, independentemente de peso_estimado.
export function isPendenciaSemPeso(c: ColetaComItens): boolean {
  return totalPesoColeta(c) === 0;
}

// Mantido para compatibilidade — agora redundante com isPendenciaSemPeso.
export function isPendenciaPesoEstimadoSemPeso(c: ColetaComItens): boolean {
  return totalPesoColeta(c) === 0 && !!c.peso_estimado;
}

// Quantidade de MTRs únicos duplicados no conjunto.
export function countMtrsDuplicadosUnicos(coletas: ColetaComItens[]): number {
  return findMtrDuplicates(coletas).size;
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

