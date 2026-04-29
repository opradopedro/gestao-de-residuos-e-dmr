## Objetivo

Refinar regras de pendência, risco, filtros e cadastros sem quebrar nada já estável. Não há mudanças no schema do banco — apenas semântica das regras e UI.

---

## 1. Coleta sem peso (nova categoria)

**Hoje:** o formulário (`ColetaForm.tsx`) bloqueia o salvamento quando qualquer item tem peso ≤ 0 (`if (!it.peso_kg || Number(it.peso_kg) <= 0) ... return null`).

**Mudança:**
- Permitir salvar coleta com `peso_kg = 0` (ou vazio → tratado como 0).
- Continuar exigindo: data, destinador e ao menos um item com tipo de resíduo.
- Mostrar aviso amarelo no formulário ("Peso não informado — coleta entrará em pendências"), mas não bloquear.

**Nova helper em `src/lib/data.ts`:**
- `isPendenciaSemPeso(c)` → `true` quando `totalPesoColeta(c) === 0`.
- `isPendenciaPesoEstimadoSemPeso(c)` → `peso_estimado === true && total === 0`.

---

## 2. Peso estimado (regra definitiva)

**Mudança:**
- Remover `confirmarPesoColeta` da `lib/data.ts` e qualquer botão que ainda exista (já removido de `pendencias.tsx`, mas `data.ts` ainda exporta a função).
- Tag "Emitido com peso estimado" continua aparecendo na listagem quando `peso_estimado === true`, **independente do peso ter ou não valor**.
- Peso estimado só vira pendência se o peso estiver vazio/zero (categoria "Peso estimado sem peso").

---

## 3. Tipos de pendência (categorias separadas)

Reescrever `src/routes/pendencias.tsx` para mostrar 4 abas, cada uma com seu próprio contador independente:

| Aba | Critério |
|---|---|
| **Sem MTR (erro)** | `!c.mtr && !c.dmr_manual` |
| **Sem peso** | `total === 0 && !c.peso_estimado` |
| **Peso estimado sem peso** | `total === 0 && c.peso_estimado` |
| **MTR duplicado** | `c.mtr && dups.has(c.mtr)` — listar todas as ocorrências, mas o **contador** mostra apenas o nº de MTRs únicos duplicados (`dups.size`), não o nº de coletas |

Cards de resumo no topo: 4 cards independentes (não somar entre si).

---

## 4. Contadores

- `useMemo` por categoria, sem somatório global.
- Badge da sidebar (`AppShell.tsx`): substituir `semMtr + estimado + dupExcess` por `semMtrErro + semPeso + estimadoSemPeso + mtrsDuplicadosUnicos` — soma apenas para o número total exibido na pílula, mas contagens internas permanecem separadas.

---

## 5. Diferenciação MTR

Já existe a flag `dmr_manual` e `isPendenciaSemMtr` já a respeita. Garantir em todas as telas:
- **Sem MTR por erro** (`!mtr && !dmr_manual`) → entra em Pendências e em Risco.
- **DMR manual** (`dmr_manual === true`) → NUNCA aparece em Pendências; aparece em Risco em um cartão **separado e informativo**, sem cor de alerta.

Adicionar helper `isSemMtrOperacao(c)` → `!c.mtr && c.dmr_manual`.

---

## 6. Dashboard de Risco

Reescrever `src/routes/risco.tsx`:

- Remover do cálculo de nível alto/médio qualquer contribuição de `dmr_manual`.
- Cartões `FatorRisco` exibidos separadamente:
  1. Sem MTR (erro)
  2. Sem MTR por operação (DMR manual) — tom neutro/info
  3. Peso estimado (apenas as com peso preenchido — informativo) e Peso estimado sem peso (erro)
  4. MTR duplicado — usa contagem de MTRs únicos
  5. Volume fora da DMR (mantém)
- Texto de cabeçalho ("frases") montado a partir das categorias separadas.

Também ajustar badge "risco" na sidebar (`AppShell.tsx`) para não escalar para "alto" só porque há `dmr_manual`.

---

## 7. Filtros (multi-seleção e busca ampliada)

Em `src/routes/coletas.index.tsx`:

- Trocar os 3 `Select` simples (resíduo/destinador/transportador) por componentes de **multi-seleção** baseados em `Popover` + `Checkbox` + `Command` (já temos shadcn). Estado vira `string[]`. `__all__` deixa de existir; lista vazia = sem filtro.
- Filtros aplicam OR dentro da mesma categoria, AND entre categorias.
- Campo de busca: já cobre MTR, transportador, destinador, resíduo, observações. Adicionar suporte a **data**: aceitar substring de `formatDate(c.data)` e do ISO `c.data`.

---

## 8. Cadastros — abas e edição

Reescrever `src/routes/cadastros.tsx`:

**Abas adicionadas:** Unidades · Tipos de resíduo · Tratamentos · **Transportadores** · **Destinadores**.

**Edição inline em todas as abas** (não apenas adicionar/remover):

| Aba | O que pode ser editado |
|---|---|
| Unidades | nome (via `updateUnidade`, novo) |
| Tipos de resíduo | nome, código, tratamento padrão (já existe `upsertTipoResiduo` com `id`) |
| Tratamentos | nome, código (já existe `upsertTratamento` com `id`) |
| Transportadores | nome, CNPJ (novo `updateTransportador`) |
| Destinadores | nome, CNPJ, **vínculos resíduo↔tratamento** (já existe `setDestinadorResiduos`) |

UI de edição: cada linha vira um modal de edição (`Dialog`) com botão lápis, ao lado do botão remover. Para destinadores, o modal inclui a tabela de vínculos (mesmo formato já usado no `QuickResiduoDialog`).

**Novas funções em `src/lib/data.ts`** (sem mudança de schema):
- `updateUnidade(id, nome)`
- `updateTransportador(id, { nome, cnpj })`
- `updateDestinador(id, { nome, cnpj })`

A edição reaproveita as queries já em cache (`tipos_residuo`, `tratamentos`, etc.) — invalidação já está implementada.

---

## Detalhes técnicos

**Arquivos modificados:**
- `src/lib/data.ts` — novos helpers de pendência, novos `updateX`, remover `confirmarPesoColeta` (e seu único uso já foi removido).
- `src/components/ColetaForm.tsx` — relaxar validação de peso, mostrar aviso.
- `src/routes/pendencias.tsx` — 4 abas + cards independentes.
- `src/routes/risco.tsx` — cards separados, lógica de nível sem `dmr_manual`.
- `src/routes/coletas.index.tsx` — multi-select e busca por data.
- `src/routes/cadastros.tsx` — 5 abas + edição inline com modal.
- `src/components/AppShell.tsx` — badge sidebar usa novas contagens.

**Componente novo:** `src/components/MultiSelectFilter.tsx` (Popover + Command + Checkbox) para reuso entre filtros.

**Garantias preservadas:**
- Schema do banco intacto.
- Separação por unidade (`unidade_id` continua na chave de query).
- Lógica DMR (`/dmr` e `lib/dmr.ts`) não tocada.
- Nenhuma migração SQL.

---

## Fora do escopo

- Não toca em `coletas.$id.tsx`, `coletas.nova.tsx`, `consolidacao.tsx`, `dmr.tsx`, `index.tsx` (dashboard).
- Mantém comportamento atual de importação em massa, modais, ordenação de tabelas.