import { supabase } from "@/integrations/supabase/client";
import type { FiltroAvancado } from "@/lib/coletas-filtros";

export type FiltroSalvo = {
  id: string;
  nome: string;
  escopo: string;
  unidade_id: string | null;
  regras: FiltroAvancado;
  criado_em: string;
};

export async function listFiltrosSalvos(escopo = "coletas"): Promise<FiltroSalvo[]> {
  const { data, error } = await (supabase as any)
    .from("filtros_salvos")
    .select("*")
    .eq("escopo", escopo)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FiltroSalvo[];
}

export async function createFiltroSalvo(input: { nome: string; escopo?: string; unidade_id?: string | null; regras: FiltroAvancado }) {
  const { data, error } = await (supabase as any)
    .from("filtros_salvos")
    .insert({
      nome: input.nome,
      escopo: input.escopo ?? "coletas",
      unidade_id: input.unidade_id ?? null,
      regras: input.regras as any,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFiltroSalvo(id: string) {
  const { error } = await (supabase as any).from("filtros_salvos").delete().eq("id", id);
  if (error) throw error;
}
