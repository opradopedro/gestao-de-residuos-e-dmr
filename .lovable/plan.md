## Resumo

Corrigir 5 pontos identificados pelo usuário no fluxo de exclusões, DMR, painel de Riscos e ordenação de pendências.

---

### 1. Exclusão em massa — múltiplas regras E/OU visíveis

**Problema:** o suporte a várias regras com combinador AND/OR já existe (via `AdvancedFilterDialog`), mas fica escondido atrás do botão "Configurar filtro" e o usuário não percebe que pode adicionar mais regras.

**Solução:** inline as regras dentro do próprio `BulkDeleteDialog` (passo "filtro"), exibindo:
- seletor de combinador E/OU no topo
- lista de regras editáveis (campo, operador, valor) reutilizando a mesma UI do `AdvancedFilterDialog`
- botão "Adicionar regra" sempre visível
- contador de coletas correspondentes atualizando em tempo real

Extrair o bloco de edição de regras de `AdvancedFilterDialog.tsx` para um componente reutilizável `FiltroRegrasEditor` e usá-lo nos dois lugares.

---

### 2. DMR — perguntar unidade ao importar

**Problema:** `src/routes/dmr.tsx` usa silenciosamente a unidade ativa global; usuário quer escolher a unidade alvo da DMR.

**Solução:** adicionar um `<Select>` "Unidade" ao lado de "Trimestre alvo" no card de upload, populado com `listUnidades()`, com a unidade ativa pré-selecionada. O upload usa a unidade escolhida no select (não a global). Mostrar aviso se a unidade selecionada for diferente da unidade ativa.

---

### 3. Painel de Risco — mostrar fatores OK em verde

**Problema:** após reordenação por criticidade, fatores sem ocorrência simplesmente somem; usuário quer ver confirmação visual ("está OK") em verde.

**Solução:** em `src/routes/risco.tsx`, montar a lista sempre incluindo todos os 8 fatores conhecidos. Cada fator ganha um status:
- `count > 0` → severidade original (vermelho/laranja/amarelo)
- `count === 0` → severidade `"verde"` com ícone `ShieldCheck` e descrição "Nenhuma ocorrência."

Ordenação: vermelho → laranja → amarelo → verde; dentro de cada grupo, alfabético pelo título. Card de cabeçalho continua usando apenas fatores não-verdes para "N fator(es) de risco".

---

### 4. Botão "Resolver" — aplicar filtro pré-selecionado

**Problema:** clicar em "Resolver" navega para `/coletas?risco=...` mas o param `risco` não é convertido em filtro; e os fatores `ibama` / `cnpj` vão para `/cadastros` sem filtro nenhum.

**Solução:**
- Em `coletas.index.tsx`: no `useMemo` de filtragem, ler `Route.useSearch().risco` e aplicar um filtro programático conforme o valor:
  - `sem_peso` → peso = 0
  - `erro_preenchimento` → usar `isErroPreenchimento`
  - `sem_mtr_dmr` → `dmr_manual = true`
  - `sem_mtr_erro` → MTR vazio e `dmr_manual = false`
  - `mtr_duplicado` → MTR dentro do set `findMtrDuplicates`
  
  Mostrar um chip "Filtro de risco: X · limpar" acima da lista para o usuário ver e poder limpar (limpar = navigate para `/coletas` sem search).

- Em `cadastros.tsx`: aceitar `validateSearch` com `?risco=ibama` ou `?risco=cnpj`, abrir a tab correspondente (`residuos` ou `destinadores`) e aplicar um filtro local mostrando apenas itens sem código IBAMA / sem CNPJ, com chip "Mostrando apenas pendentes · ver todos".

- Em `risco.tsx`: ajustar as navegações para incluir os params certos (a maioria já está; `ibama` e `cnpj` passam a enviar `?risco=ibama|cnpj`).

---

### 5. Excluir unidade com "Não transferir" — permitir prosseguir

**Problema:** em `EntityDeleteDialog.tsx`, a flag `isUnidadeBlocked = tipo === "unidade" && transferTo === "__none__" && afetados > 0` desabilita o botão. Usuário quer que prossiga e deixe as coletas em Pendências.

**Solução:** remover o bloqueio especial de unidade. O fluxo passa a ser:
- "Não transferir" + `afetados > 0` → mostra o passo de confirmação (já existe) com texto "X coletas ficarão sem unidade e aparecerão em Pendências".
- Botão "Sim, excluir e desvincular X" fica habilitado.
- Em `src/lib/data.ts`, ajustar `deleteEntidadeComTransferencia` para permitir excluir unidade mesmo com coletas vinculadas, definindo `unidade_id = null` nas coletas afetadas (e garantindo que a coluna seja nullable). **Pré-requisito:** migração para tornar `coletas.unidade_id` nullable. Atualizar `risco.tsx` / `pendencias` para listar coletas com `unidade_id IS NULL` como pendência "Coleta sem unidade".

---

### Arquivos afetados

- `src/components/BulkDeleteDialog.tsx` — inline regras
- `src/components/AdvancedFilterDialog.tsx` — extrair `FiltroRegrasEditor`
- `src/routes/dmr.tsx` — select de unidade no upload
- `src/routes/risco.tsx` — fatores OK em verde + ordenação
- `src/routes/coletas.index.tsx` — aplicar filtro do `risco` search param + chip
- `src/routes/cadastros.tsx` — aceitar `?risco=` e filtrar tab correspondente
- `src/components/EntityDeleteDialog.tsx` — desbloquear exclusão de unidade
- `src/lib/data.ts` — permitir `unidade_id = null` em coletas órfãs + detectar como pendência
- Migração: `ALTER TABLE coletas ALTER COLUMN unidade_id DROP NOT NULL;`

### Fora de escopo

- Mudanças visuais maiores nos cards de risco.
- Novos filtros salvos automaticamente a partir do risco.
