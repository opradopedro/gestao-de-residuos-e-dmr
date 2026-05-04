CREATE TABLE IF NOT EXISTS public.filtros_salvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  escopo text NOT NULL DEFAULT 'coletas',
  unidade_id uuid NULL,
  regras jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.filtros_salvos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public all filtros_salvos" ON public.filtros_salvos;
CREATE POLICY "public all filtros_salvos" ON public.filtros_salvos FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_filtros_salvos_escopo ON public.filtros_salvos(escopo);