import { fetchAllPages } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export type DmrUpload = {
  id: string;
  unidade_id: string;
  ano: number;
  trimestre: number;
  arquivo_nome: string;
  mapeamento: Record<string, string>;
  criado_em: string;
};

export type DmrLinha = {
  id: string;
  upload_id: string;
  residuo: string | null;
  destinador: string | null;
  peso_kg: number | null;
  mtr: string | null;
  data: string | null;
};

export type DmrMapeamento = {
  residuo?: string;
  destinador?: string;
  peso_kg?: string;
  mtr?: string;
  data?: string;
};

export async function createDmrUpload(input: {
  unidade_id: string;
  ano: number;
  trimestre: number;
  arquivo_nome: string;
  mapeamento: DmrMapeamento;
  linhas: { residuo?: string; destinador?: string; peso_kg?: number; mtr?: string; data?: string }[];
}): Promise<string> {
  const { data: up, error } = await supabase
    .from("dmr_uploads")
    .insert({
      unidade_id: input.unidade_id,
      ano: input.ano,
      trimestre: input.trimestre,
      arquivo_nome: input.arquivo_nome,
      mapeamento: input.mapeamento as any,
    })
    .select()
    .single();
  if (error) throw error;
  if (input.linhas.length > 0) {
    const { error: e2 } = await supabase.from("dmr_linhas").insert(
      input.linhas.map((l) => ({
        upload_id: up.id,
        residuo: l.residuo ?? null,
        destinador: l.destinador ?? null,
        peso_kg: l.peso_kg ?? null,
        mtr: l.mtr ?? null,
        data: l.data ?? null,
      }))
    );
    if (e2) throw e2;
  }
  return up.id;
}

export async function listDmrUploads(unidade_id: string): Promise<DmrUpload[]> {
  const { data, error } = await supabase
    .from("dmr_uploads")
    .select("*")
    .eq("unidade_id", unidade_id)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function getDmrLinhas(upload_id: string): Promise<DmrLinha[]> {
  return fetchAllPages<DmrLinha>((from, to) =>
    supabase.from("dmr_linhas").select("*").eq("upload_id", upload_id).order("id").range(from, to) as any,
  );
}

export async function deleteDmrUpload(id: string) {
  const { error } = await supabase.from("dmr_uploads").delete().eq("id", id);
  if (error) throw error;
}

/** Migra grupo_key das revisões após renomear resíduo/destinador, para preservar observações. */
async function migrateRevisoesGrupoKey(uploadId: string, kind: "residuo" | "destinador", fromText: string, toText: string) {
  const { data: revs, error } = await (supabase as any).from("dmr_revisoes").select("id, grupo_key").eq("upload_id", uploadId);
  if (error) throw error;
  const nFrom = fromText.trim().toLowerCase();
  const nTo = toText.trim().toLowerCase();
  for (const r of (revs ?? []) as { id: string; grupo_key: string }[]) {
    const [res, dest] = r.grupo_key.split("||");
    let newKey: string | null = null;
    if (kind === "residuo" && res === nFrom) newKey = `${nTo}||${dest}`;
    if (kind === "destinador" && dest === nFrom) newKey = `${res}||${nTo}`;
    if (!newKey || newKey === r.grupo_key) continue;
    const { error: upErr } = await (supabase as any).from("dmr_revisoes").update({ grupo_key: newKey }).eq("id", r.id);
    if (upErr) {
      // Provável colisão com chave já existente — descartamos a antiga.
      await (supabase as any).from("dmr_revisoes").delete().eq("id", r.id);
    }
  }
}

/** Renomeia o texto do resíduo nas linhas de um upload (usado quando o usuário
 *  resolve um resíduo não cadastrado, escolhendo um existente ou criando um novo). */
export async function renameDmrLinhasResiduo(uploadId: string, fromText: string, toText: string) {
  const { error } = await supabase
    .from("dmr_linhas")
    .update({ residuo: toText })
    .eq("upload_id", uploadId)
    .eq("residuo", fromText);
  if (error) throw error;
  await migrateRevisoesGrupoKey(uploadId, "residuo", fromText, toText);
}

/** Renomeia o texto do destinador nas linhas de um upload (usado quando o usuário
 *  resolve um destinador não cadastrado, escolhendo um existente ou criando um novo). */
export async function renameDmrLinhasDestinador(uploadId: string, fromText: string, toText: string) {
  const { error } = await supabase
    .from("dmr_linhas")
    .update({ destinador: toText })
    .eq("upload_id", uploadId)
    .eq("destinador", fromText);
  if (error) throw error;
  await migrateRevisoesGrupoKey(uploadId, "destinador", fromText, toText);
}

export type DmrRevisaoStatus = "ok" | "pendente";
export type DmrRevisao = {
  id: string;
  upload_id: string;
  grupo_key: string;
  status: DmrRevisaoStatus;
  observacoes: string | null;
};

export async function listDmrRevisoes(upload_id: string): Promise<DmrRevisao[]> {
  const { data, error } = await (supabase as any)
    .from("dmr_revisoes")
    .select("*")
    .eq("upload_id", upload_id);
  if (error) throw error;
  return (data ?? []) as DmrRevisao[];
}

export async function upsertDmrRevisao(input: {
  upload_id: string;
  grupo_key: string;
  status?: DmrRevisaoStatus;
  observacoes?: string | null;
}) {
  const payload: any = { upload_id: input.upload_id, grupo_key: input.grupo_key };
  if (input.status !== undefined) payload.status = input.status;
  if (input.observacoes !== undefined) payload.observacoes = input.observacoes;
  const { error } = await (supabase as any)
    .from("dmr_revisoes")
    .upsert(payload, { onConflict: "upload_id,grupo_key" });
  if (error) throw error;
}
