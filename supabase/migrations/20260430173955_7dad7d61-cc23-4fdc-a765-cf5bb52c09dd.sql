
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id UUID NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NULL,
  rollback_disponivel BOOLEAN NOT NULL DEFAULT false,
  revertido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS audit_log_criado_em_idx ON public.audit_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS audit_log_unidade_idx ON public.audit_log (unidade_id);
