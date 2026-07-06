CREATE TABLE public.dmr_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.dmr_uploads(id) ON DELETE CASCADE,
  grupo_key text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('ok','pendente')),
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (upload_id, grupo_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dmr_revisoes TO anon, authenticated;
GRANT ALL ON public.dmr_revisoes TO service_role;

ALTER TABLE public.dmr_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all dmr_revisoes" ON public.dmr_revisoes FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_dmr_revisoes_atualizado
BEFORE UPDATE ON public.dmr_revisoes
FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();