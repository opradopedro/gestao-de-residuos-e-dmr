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
  const { data, error } = await supabase.from("dmr_linhas").select("*").eq("upload_id", upload_id).limit(5000);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function deleteDmrUpload(id: string) {
  const { error } = await supabase.from("dmr_uploads").delete().eq("id", id);
  if (error) throw error;
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
}
