
-- Add code to tipos_residuo
ALTER TABLE public.tipos_residuo ADD COLUMN IF NOT EXISTS codigo text;

-- Create tratamentos table
CREATE TABLE IF NOT EXISTS public.tratamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tratamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public all tratamentos" ON public.tratamentos;
CREATE POLICY "public all tratamentos" ON public.tratamentos FOR ALL USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS tratamentos_nome_uniq ON public.tratamentos (lower(nome));
CREATE UNIQUE INDEX IF NOT EXISTS tipos_residuo_nome_uniq ON public.tipos_residuo (lower(nome));
