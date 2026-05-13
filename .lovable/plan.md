## Plano de correções e melhorias

Organizei as ~25 demandas em 6 fases para ataque coordenado. Cada fase termina em estado utilizável; fases pesadas ficam por último.

### Fase 1 — Riscos & Pendências (unificação) e correções pontuais

1. **Tooltip do "!" no menu lateral** (`src/components/AppShell.tsx`): substituir badge estático por `TooltipProvider/Tooltip` que usa `getColetaRiscos` + helpers (`countMtrDuplicatesExcess`, `isPendenciaSemMtr`, `isPendenciaSemPeso`, novo `hasErrosPreenchimento`) para listar resumo ("2 sem MTR · 1 sem peso · 1 MTR duplicado · 3 erros de preenchimento").
2. **Peso = 0 reconhecido como risco**: `isPendenciaSemPeso` já trata, mas a tela de Risco (`src/routes/risco.tsx`) usa filtro errado. Revisar para usar `totalPesoColeta(c) === 0` direto. Também aceitar itens com `peso_kg === 0`.
3. **Renomear "Operação Manual" → "MTR não Emitido (Incluir na DMR)"** em todas as telas (`risco.tsx`, `coletas.index.tsx`, `ColetaViewDialog.tsx`, badges, banners, audit). Obs: Adicionar o incluir na DMR somente quando houver espaço e ficar visualmente bonito.
4. **Página de risco — explicação dos níveis**: adicionar bloco "Entenda os indicadores" (Vermelho/Laranja/Amarelo) no topo de `risco.tsx`.
5. **Nova seção "Erros de preenchimento"** em `risco.tsx`: filtra coletas com qualquer campo nulo (data, destinador, transportador, tipo_residuo_nome, tratamento), exceto peso (que já tem seção própria).
6. **Drill-down dos cards de risco**: cada card navega para `/coletas?filtroRisco=<tipo>` com pré-aplicação do filtro avançado equivalente. Adicionar suporte em `coletas.index.tsx` para ler `search` params e popular `AdvancedFilterDialog`.
7. **Remover página Pendências** (`src/routes/pendencias.tsx`) e item de menu; redirecionar `/pendencias` → `/risco` (que vira "Riscos e Pendências").

### Fase 2 — Filtros e exclusão em massa

1. **Filtro avançado em todos os locais que tem filtro**: cadastros (`cadastros.tsx`), DMR (`dmr.tsx`), histórico, etc. Extrair `AdvancedFilterDialog` em modo genérico aceitando `fields: {key,label,type}[]`.
2. `**BulkDeleteDialog` usar mesmo motor do filtro avançado**: substituir o filtro simples atual (campo/op/valor único) por `AdvancedFilterDialog` com regras combináveis (igual, contém, não contém, vazio, não vazio, intervalo de datas, etc). Adicionar campo "Unidade" como opção.
3. **Exclusão em massa nos cadastros**: novo `BulkDeleteEntidadesDialog` para resíduos/tratamentos/transportadores/destinadores. Para cada item perguntar transferência (mesma UX do `EntityDeleteDialog`) ou deixar como pendência. Auditável.
4. `**EntityDeleteDialog` — permitir "Não transferir"**: hoje trava porque `deleteEntidadeComTransferencia` provavelmente erra quando `transferTo === null`. Ajustar `src/lib/data.ts` para deslinkar (set null) e seguir adiante; após escolha, abrir confirmação extra ("Tem certeza? Isto desvinculará N registros que aparecerão em Pendências").

### Fase 3 — Edição rápida & modais consistentes

1. **Click em coleta abre modal de edição** (não navegar para rota): substituir `ColetaViewDialog` por `ColetaEditDialog` que usa `ColetaForm` com botões "Voltar" e "Salvar alterações" (desabilitado até `isDirty`). Aplicar em coletas, drill-down de risco, conflitos.
2. **Padronizar todos os "Quick…" e "…FullDialog"**:
  - `QuickTratamentoDialog` x dialog de tratamento em `cadastros.tsx`: mesmos campos (Nome, Código opcional), mesma validação.
  - Idem para resíduo, destinador, transportador. Extrair um único componente reutilizável por entidade.
3. **Autocomplete + cancelar quick dialog**: ao fechar (X / overlay click) o `QuickResiduoDialog`/`QuickTratamentoDialog`, limpar o valor digitado no campo de origem (ColetaForm). Hoje texto fica órfão.
4. **Tratamento sem cadastro no `ColetaForm**`: hoje só resíduo abre modal automático. Aplicar `strictOnBlur` igual no campo Tratamento, abrindo `QuickTratamentoDialog`.
5. **"Ver todos" do destinador**: corrigir lógica em `cadastros.tsx`/`ColetaForm` que não está respondendo. Quando usuário marca um resíduo da lista expandida, chamar `autoLinkResiduosDestinador` para vincular ao destinador específico imediatamente (com toast).

### Fase 4 — CNPJ, código IBAMA, MTR provisório

1. **Validação oficial de CNPJ** (`src/lib/format.ts` ou novo `src/lib/cnpj.ts`):
  - `normalizeCNPJ(s)`: só dígitos.
  - `isValidCNPJ(s)`: 14 dígitos + verificação de DV oficial + rejeitar sequências repetidas (00000000000000…).
  - `formatCNPJ(s)`: `00.000.000/0000-00`.
  - Aplicar em `QuickEntityDialog` (destinador/transportador) e em cadastros. Salvar normalizado; exibir formatado ao lado do nome em todos os locais (selects, listas, badges).
2. **Código IBAMA**:
  - `normalizeCodigoIbama(s)`: extrai 6 dígitos + opcional `*`. Aceita formatos `16 10 01*`, `161001`, `150202(*)`.
  - `formatCodigoIbama(s)`: sempre `## ## ##` + `*` se for perigoso.
  - Aplicar em `TipoResiduoEditDialog`, `QuickResiduoDialog`, e na resolução de resíduos da DMR (`resolveResiduoCanonical`) para casar `150202(*)` com `150202*`.
3. **MTR provisório**:
  - Em `ColetaImportWizard.parsedRows`, antes do `dmr_manual` check, detectar regex `/\bP\d{4,}\b/i` e usar como MTR (não tratar como manual).
  - Mesma detecção em `dmr.ts` (parser DMR).

### Fase 5 — Importação de coletas (PRIORIDADE ALTA — duplicatas)

Causas identificadas no fluxo atual (`ColetaImportWizard.tsx`):

- O fingerprint de "sem MTR" inclui `tratamento` e `residuo` em lowercase do **valor do arquivo**, mas no banco eles foram normalizados pelo `missingMap` (substituídos por nomes canônicos). Re-importação compara texto cru × texto canônico → 16 falsos negativos.
- Coletas marcadas `dmr_manual` perdem `mtr` (vira ""), então fingerprint vira "nm:data|dest|trans" — qualquer pequena diferença de tratamento/residuo escapa.
- Itens importados em **uma só coleta** quando deveriam ser separados (ex: 03/07 Madeira + Lixo Seco).

Plano:

1. **Aplicar `missingMap` ANTES de gerar fingerprint**: no `parsedRows`, substituir `residuo`/`tratamento`/`destinador`/`transportador` para o nome canônico escolhido pelo usuário antes de agrupar.
2. **Fingerprint canônico unificado**: criar `coletaFingerprint(c|grupo)` em `src/lib/data.ts` — sempre baseado em (data + destinador normalizado + transportador normalizado + Σ itens [residuo norm | tratamento norm | peso arredondado 3 casas]). Usar **a mesma função** em import wizard, `checkMergeConflicts` e novo detector de merge sem MTR.
3. **Tela "DMR/Manual: agrupamento"** (novo step do wizard, antes de `review`): listar todos os grupos `dmr_manual` que possuem >1 item; permitir marcar item-a-item "manter junto" / "separar". Suportar regra global ("separar tudo", "separar por resíduo", "manter agrupado se mesmo destinador").
4. **Cadastros faltantes obrigatórios**: o wizard só avança quando todos os ausentes têm `missingMap[chave] !== undefined` (cadastrar novo OU substituir). UI atual com "cadastre um a um, contador embaixo (3 de 7)" — bloquear botão Avançar.
5. **Detecção de duplicatas em DMR manual**: usar fingerprint canônico independentemente de `mtr === ""`.
6. **Suíte de testes manual**: documentar no PR roteiro de re-importar `Controle_de_Coletas.xlsx` 2x, garantir 0 novas coletas. Validar com user.

### Fase 6 — DMR, merge & histórico

1. **DMR — bug do "pula de 2 em 2"** (`DmrResolveResiduosDialog`): índice deriva da lista filtrada que se atualiza ao vivo após cada `renameDmrLinhasResiduo`. Solução: congelar a lista de pendências no estado local na abertura do dialog; só refazer a query ao fechar.
2. **DMR — destinadores não cadastrados**: replicar fluxo de resíduos com `DmrResolveDestinadoresDialog` (substituir / criar novo).
3. **Histórico — exclusão de cadastro**: `cadastros.tsx` deve registrar `audit_log` em deletes/edits de tipo_residuo, tratamento, transportador, destinador (com snapshot para rollback).
4. **Histórico — ver registros afetados**: `HistoryDialog` deve, para entradas de tipo "import" / "bulk_delete", exibir lista (do `snapshot`) com link para abrir cada coleta no novo `ColetaEditDialog`.
5. **Merge com conflitos — UX nova**:
  - Em `MergeDialog` (`cadastros.tsx`), para cada par exibir cards lado-a-lado com nomes reais ("MTR 250003976498 — Multilixo" vs "MTR 250003976498 — Multibio Energia") e radio "Manter A" / "Manter B".
  - Botões "Pré-selecionar todos A" / "Pré-selecionar todos B".
  - Habilitar botão "Confirmar merge" mesmo com conflitos não resolvidos? **Não** — mas resolver = escolher A ou B (em vez de "ir editar"). A escolha deleta a outra coleta no mesmo passo da merge.
  - Travamento em DMR manual: garantir que detecção use fingerprint canônico (Fase 5.2).
6. **Detecção de duplicata sem MTR aplicada em todos os fluxos**: import, merge, e novo botão "Detectar duplicatas" na tela de coletas (opcional, se sobrar tempo).

### Correções pontuais menores (vão entrando ao longo das fases acima)

- **Coletas — escopo "ver todas" mostra período errado** (`coletas.index.tsx`): texto "(período Jan-Mar 2026)" deve ser substituído por "(período: Total)" quando `escopo === "todas"`. Bug em template literal — checar e ajustar.

### Detalhes técnicos

- Sem mudanças de schema. Tudo client-side + helpers em `src/lib/`.
- `audit_log` já cobre snapshot + rollback; basta novos `tipo` para "cadastro_excluido", "cadastro_editado".
- `ColetaEditDialog` reutiliza `ColetaForm` com prop `mode="edit"` + handlers de dirty-check.
- Nenhuma necessidade de novo secret / migration.

### Ordem sugerida de execução

1. Fase 1 (curta, alto impacto visual)
2. Fase 4 (CNPJ + IBAMA + MTR provisório — base para outras fases)
3. Fase 5 (CRÍTICA — duplicatas)
4. Fase 2 (filtros & bulk)
5. Fase 3 (UX modais)
6. Fase 6 (DMR/merge/histórico)

Pergunta antes de implementar: **posso começar pela Fase 1 + Fase 4 em conjunto** (são as mais isoladas), e depois atacar a Fase 5 sozinha (por ser sensível a regressões)?