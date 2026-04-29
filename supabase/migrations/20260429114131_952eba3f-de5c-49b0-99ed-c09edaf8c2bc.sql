-- 1) Transportadores
CREATE TABLE public.transportadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX transportadores_nome_unique ON public.transportadores (lower(nome));
ALTER TABLE public.transportadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all transportadores" ON public.transportadores FOR ALL USING (true) WITH CHECK (true);

-- 2) Destinadores
CREATE TABLE public.destinadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX destinadores_nome_unique ON public.destinadores (lower(nome));
ALTER TABLE public.destinadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all destinadores" ON public.destinadores FOR ALL USING (true) WITH CHECK (true);

-- 3) Vínculo destinador <-> tipo de resíduo (com tratamento associado)
CREATE TABLE public.destinador_residuos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinador_id uuid NOT NULL REFERENCES public.destinadores(id) ON DELETE CASCADE,
  tipo_residuo_id uuid NOT NULL REFERENCES public.tipos_residuo(id) ON DELETE CASCADE,
  tratamento text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destinador_id, tipo_residuo_id)
);
CREATE INDEX destinador_residuos_destinador_idx ON public.destinador_residuos (destinador_id);
ALTER TABLE public.destinador_residuos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all destinador_residuos" ON public.destinador_residuos FOR ALL USING (true) WITH CHECK (true);

-- 4) Coletas: novas referências e flag dmr_manual
ALTER TABLE public.coletas
  ADD COLUMN transportador_id uuid REFERENCES public.transportadores(id) ON DELETE SET NULL,
  ADD COLUMN destinador_id uuid REFERENCES public.destinadores(id) ON DELETE SET NULL,
  ADD COLUMN dmr_manual boolean NOT NULL DEFAULT false;

CREATE INDEX coletas_transportador_id_idx ON public.coletas (transportador_id);
CREATE INDEX coletas_destinador_id_idx ON public.coletas (destinador_id);

-- 5) Limpar DMRs antigas (passam a ser lidas em toneladas)
DELETE FROM public.dmr_linhas;
DELETE FROM public.dmr_uploads;