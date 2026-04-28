
# Plano — SaaS de Gestão e Conferência de DMR

Sistema multiunidade para registrar coletas de resíduos, identificar pendências (sem MTR / peso estimado), consolidar por trimestre e conferir contra a DMR via upload de Excel. Sem login nesta versão; validações apenas sinalizam (não bloqueiam).

## Entidades (Lovable Cloud / Postgres)

- `unidades` (id, nome, criado_em)
- `tipos_residuo` (id, nome, tratamento_padrao) — populada com lista inicial sugerida
- `coletas` (id, unidade_id, data, transportador, destinador, mtr, peso_estimado bool, observacoes, criado_em)
- `coleta_itens` (id, coleta_id, tipo_residuo_id, peso_kg, tratamento)
- `dmr_uploads` (id, unidade_id, trimestre, arquivo_nome, mapeamento_jsonb, criado_em)
- `dmr_linhas` (id, upload_id, residuo, destinador, peso_kg, mtr, data)

Separação por unidade aplicada em todas as queries (filtro `unidade_id`). Sem RLS pois não há login agora — preparado para adicionar depois.

Lista inicial de resíduos (exemplos, editáveis): Papel/Papelão→Reciclagem, Plástico→Reciclagem, Vidro→Reciclagem, Metal→Reciclagem, Orgânico→Compostagem, Rejeito→Aterro Sanitário, Resíduo de Saúde Infectante→Incineração, Perfurocortantes→Incineração, Químico→Tratamento Químico, Eletroeletrônico→Logística Reversa, Lâmpadas→Descontaminação, Óleo Usado→Rerrefino.

## Telas e fluxos

```text
Sidebar
├─ Seletor de Unidade (global, persiste em localStorage)
├─ Dashboard
├─ Coletas
│   ├─ Lista
│   └─ Nova / Editar
├─ Pendências
├─ Consolidação trimestral
├─ DMR (upload e conferência)
└─ Cadastros (Unidades, Tipos de Resíduo)
```

### 1. Dashboard (por unidade)
Cards: total de coletas no trimestre atual, peso total, nº pendências sem MTR, peso estimado pendente, “X toneladas fora do sistema oficial”. Gráfico de pesos por tipo de resíduo e por destinador.

### 2. Coletas
- **Lista**: filtros por trimestre, destinador, status (OK / sem MTR / estimado / alerta peso).
- **Nova coleta**: data padrão = hoje, unidade = unidade ativa, transportador, destinador, MTR (opcional), checkbox peso estimado, observações livre. Adiciona N itens (tipo de resíduo → tratamento auto-sugerido e editável, peso obrigatório). Permite atualizar MTR depois pela edição.
- Sinalizadores visuais (badges) quando peso > 50.000 kg/item ou MTR repetido em coletas diferentes nos últimos 90 dias. Nunca bloqueia salvar.

### 3. Pendências
Duas abas: **Sem MTR** e **Peso estimado**. Mostra contagem, peso total e botão para abrir/corrigir a coleta. Banner de impacto agregado.

### 4. Consolidação trimestral
Agrupamento automático em trimestres calendário (Jan-Mar, Abr-Jun, Jul-Set, Out-Dez). Tabelas pivot por tipo de resíduo × destinador com soma de pesos. Botão **Exportar XLSX** gera uma planilha por trimestre (já filtrada pela unidade ativa) usando openpyxl no servidor.

### 5. Módulo DMR
- Upload de `.xlsx` para a unidade + trimestre selecionados.
- Preview das primeiras linhas e **tela de mapeamento manual**: o usuário associa cada coluna do Excel aos campos do sistema (Resíduo, Destinador, Peso, MTR, Data). Mapeamento salvo no upload.
- Conferência: agrupa DMR e dados internos por (tipo de resíduo, destinador) e mostra tabela comparativa com colunas Interno / DMR / Divergência (kg e %).
- Para cada divergência, painel de **causas sugeridas**: lista coletas sem MTR e coletas com peso estimado do mesmo grupo no trimestre, com link para correção.

### 6. Cadastros
CRUD simples de Unidades e de Tipos de Resíduo (com tratamento padrão).

## Detalhes técnicos

- TanStack Start + Tailwind + shadcn/ui (já no projeto).
- Lovable Cloud para banco; migrações criando todas as tabelas e seed dos tipos de resíduo.
- Server functions (`createServerFn`) para: criar/atualizar coleta, listar por unidade, calcular pendências/totais, gerar XLSX (openpyxl não está disponível em Worker — usar `exceljs` no servidor ou `xlsx` puro JS para leitura/escrita), processar upload da DMR (parse com `xlsx`), salvar mapeamento e rodar comparação.
- TanStack Query para cache; loaders chamando `ensureQueryData`.
- Rotas separadas por seção (`/`, `/coletas`, `/coletas/nova`, `/coletas/$id`, `/pendencias`, `/consolidacao`, `/dmr`, `/cadastros/unidades`, `/cadastros/residuos`).
- Validação com Zod nos forms e nas server functions.
- Estrutura preparada para adicionar autenticação e auditoria depois (campos `criado_em` já presentes; fácil acrescentar `criado_por` e tabela `audit_log`).

## Fora de escopo nesta versão
Login/usuários, RLS por usuário, auditoria detalhada, notificações, integração direta com SINIR.
