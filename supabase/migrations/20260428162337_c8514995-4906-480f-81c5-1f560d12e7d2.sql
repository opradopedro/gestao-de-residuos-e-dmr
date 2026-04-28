
-- UNIDADES
create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- TIPOS DE RESÍDUO
create table public.tipos_residuo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tratamento_padrao text not null,
  criado_em timestamptz not null default now()
);

-- COLETAS
create table public.coletas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  data date not null default current_date,
  transportador text,
  destinador text,
  mtr text,
  peso_estimado boolean not null default false,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index idx_coletas_unidade on public.coletas(unidade_id);
create index idx_coletas_data on public.coletas(data);
create index idx_coletas_mtr on public.coletas(mtr);

-- ITENS DA COLETA
create table public.coleta_itens (
  id uuid primary key default gen_random_uuid(),
  coleta_id uuid not null references public.coletas(id) on delete cascade,
  tipo_residuo_id uuid references public.tipos_residuo(id) on delete set null,
  tipo_residuo_nome text not null,
  peso_kg numeric(14,3) not null check (peso_kg >= 0),
  tratamento text not null,
  criado_em timestamptz not null default now()
);
create index idx_itens_coleta on public.coleta_itens(coleta_id);

-- UPLOAD DMR
create table public.dmr_uploads (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  ano int not null,
  trimestre int not null check (trimestre between 1 and 4),
  arquivo_nome text not null,
  mapeamento jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index idx_dmr_uploads_unidade on public.dmr_uploads(unidade_id);

create table public.dmr_linhas (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.dmr_uploads(id) on delete cascade,
  residuo text,
  destinador text,
  peso_kg numeric(14,3),
  mtr text,
  data date,
  criado_em timestamptz not null default now()
);
create index idx_dmr_linhas_upload on public.dmr_linhas(upload_id);

-- TRIGGER de atualização
create or replace function public.touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
create trigger trg_coletas_touch before update on public.coletas
  for each row execute function public.touch_atualizado_em();

-- RLS (acesso público nesta versão sem login)
alter table public.unidades enable row level security;
alter table public.tipos_residuo enable row level security;
alter table public.coletas enable row level security;
alter table public.coleta_itens enable row level security;
alter table public.dmr_uploads enable row level security;
alter table public.dmr_linhas enable row level security;

create policy "public all unidades" on public.unidades for all using (true) with check (true);
create policy "public all tipos_residuo" on public.tipos_residuo for all using (true) with check (true);
create policy "public all coletas" on public.coletas for all using (true) with check (true);
create policy "public all coleta_itens" on public.coleta_itens for all using (true) with check (true);
create policy "public all dmr_uploads" on public.dmr_uploads for all using (true) with check (true);
create policy "public all dmr_linhas" on public.dmr_linhas for all using (true) with check (true);

-- SEED tipos de resíduo
insert into public.tipos_residuo (nome, tratamento_padrao) values
  ('Papel/Papelão', 'Reciclagem'),
  ('Plástico', 'Reciclagem'),
  ('Vidro', 'Reciclagem'),
  ('Metal', 'Reciclagem'),
  ('Orgânico', 'Compostagem'),
  ('Rejeito', 'Aterro Sanitário'),
  ('Resíduo de Saúde Infectante', 'Incineração'),
  ('Perfurocortantes', 'Incineração'),
  ('Químico', 'Tratamento Químico'),
  ('Eletroeletrônico', 'Logística Reversa'),
  ('Lâmpadas', 'Descontaminação'),
  ('Óleo Usado', 'Rerrefino');
