# Correções no fluxo de coleta — vínculos, autocomplete e modais

Foco: corrigir o filtro de resíduos por destinador, permitir criação inline de resíduos/tratamentos via modal a partir do autocomplete, validar vínculos com botão de "Adicionar vínculo", e atualizar tratamento ao trocar resíduo. Sem alterar o schema do banco.

## 1. Bug — filtro de resíduos por destinador (`ColetaForm.tsx`)

Atualmente o `tipoOptions` ignora completamente os vínculos: mostra todos os tipos mesmo quando o destinador tem vínculos. Além disso, a mensagem "sem resíduos vinculados" só some quando `vinculosDest.length > 0`, mas isso depende da query estar resolvida.

Correção:
- `tipoOptions` passa a depender de `destinadorId` + `vinculosDest`:
  - Se `destinadorId` definido **e** `vinculosDest.length > 0`: filtrar `tipos` para apenas os `tipo_residuo_id` presentes em `vinculosDest`.
  - Caso contrário: retornar todos os tipos.
- Mensagem "Destinador sem resíduos vinculados — todos serão exibidos" só renderiza quando `destinadorId && !isLoadingVinculos && vinculosDest.length === 0`. Adicionar `isLoading` da query (`useQuery` retorna `isLoading`/`isFetching`) para não piscar a mensagem antes da resposta.
- Garantir reatividade ao trocar destinador: ao mudar `destinadorId` para um diferente, limpar/manter itens (não limpar — só refiltra opções e exibe aviso por linha quando `tipo_residuo_id` atual não estiver no novo conjunto, lógica `naoVinculado` já existe).

## 2/3/4. Autocomplete "Adicionar novo" para resíduo e tratamento + modais

Hoje o `Autocomplete` dos itens (resíduo e tratamento) não passa `onCreate`. Criar dois novos modais e ligar os callbacks.

Novos componentes:

**`src/components/QuickResiduoDialog.tsx`** — modal para criar `tipos_residuo`:
- Campos: Nome (pré-preenchido), Código IBAMA (texto livre, ex: `01 01 19`), Tratamento padrão (Autocomplete sobre `listTratamentos`).
- Lista de destinadores existentes (checkbox múltiplo) usando `listDestinadores`.
- Ao salvar:
  1. `upsertTipoResiduo({ nome, codigo, tratamento_padrao })` — alterar `upsertTipoResiduo` para retornar o registro inserido (ajuste em `src/lib/data.ts` para usar `.select().single()` no insert e devolver o id/objeto).
  2. Para cada destinador marcado: `addDestinadorResiduo(destinador_id, tipo_id, tratamento_padrao)`.
  3. Invalidar `["tipos_residuo"]` e `["destinador_residuos"]`.
  4. `onCreated(tipo)` para o form preencher a linha que disparou a criação.

**`src/components/QuickTratamentoDialog.tsx`** — modal para criar `tratamentos`:
- Campo: Nome (pré-preenchido). Código opcional.
- Salvar via `upsertTratamento` (também ajustado para retornar o registro inserido).
- Invalidar `["tratamentos"]` e `onCreated(nome)`.

Em `ColetaForm.tsx`:
- Adicionar estado `residuoDialog` com `{ open, defaultName, lineIndex }` e `tratDialog` com `{ open, defaultName, lineIndex }`.
- Passar `onCreate={(name) => setResiduoDialog({ open: true, defaultName: name, lineIndex: i })}` no Autocomplete de resíduo.
- Idem para tratamento.
- `onCreated` do `QuickResiduoDialog`: chama `selecionarTipoPorNome(lineIndex, tipo.nome)` com o novo tipo (forçando o id via patch direto: `updateItem(lineIndex, { tipo_residuo_id: tipo.id, tipo_residuo_nome: tipo.nome, tratamento: tipo.tratamento_padrao })`).
- `onCreated` do `QuickTratamentoDialog`: `updateItem(lineIndex, { tratamento: nome })`.

## 5. Validação destinador × resíduo + botão "Adicionar vínculo"

Hoje existe a marcação `naoVinculado` por linha (apenas texto). Acrescentar:

- Acima da seção "Itens da coleta", se `destinadorId && vinculosDest.length > 0` e existir alguma linha com `tipo_residuo_id` válido fora do `validIds`, renderizar um alerta (warning):
  > "Destinador {destinadorNome} não está vinculado a: {lista de nomes de resíduos}"
  > Botão **"Adicionar vínculo"**.
- Ao clicar: para cada item não-vinculado com `tipo_residuo_id` e `tratamento`, executar `addDestinadorResiduo(destinadorId, tipo_id, tratamento)` em paralelo, depois `qc.invalidateQueries(["destinador_residuos", destinadorId])`. O alerta some sozinho quando os vínculos chegarem.
- Manter a marcação inline por linha (já existente) como reforço visual, mas remover quando o vínculo passar a existir.

Remover a auto-criação silenciosa de vínculos no `ensureVinculo` (substituída pela ação explícita do usuário, evitando criar vínculos sem confirmação).

## 6. Atualização automática do tratamento ao trocar resíduo

Em `selecionarTipoPorNome` o tratamento só é setado quando o campo está vazio (`tratamento || ...`). Mudar para sempre sobrescrever **na linha atual** quando o usuário escolhe um resíduo da lista (opt presente), priorizando:

1. Vínculo `vinculosDest` para `(destinadorId, tipo.id)` se existir.
2. `tipo.tratamento_padrao`.

Para distinguir "escolheu da lista" vs "está apenas digitando", o `Autocomplete` já invoca `onChange(value, option)` com `option` definido na seleção. Ajustar `selecionarTipoPorNome` para receber também o `option` (assinatura `(i, value, option?)`) e só sobrescrever o tratamento quando `option` estiver presente. Quando o usuário só digita texto livre, manter o tratamento atual.

Exceção atendida: o `setItens` faz `map` retornando o item alterado apenas no índice `i` — outras linhas ficam intactas.

## 7. UX dos modais

`src/components/ui/dialog.tsx` já usa `w-[min(90vw,72rem)] max-h-[90vh] overflow-y-auto`. Ajustar para preferir não ter scroll quando couber:
- Trocar `overflow-y-auto` por `overflow-y-auto` apenas quando necessário — manter `max-h-[90vh]` e adicionar `h-auto` (já é o default). Sem mudança estrutural; verificar que `QuickEntityDialog` não usa `max-w-lg` rígido (atual usa `max-w-lg` que conflita com 90vw — remover/relaxar para `sm:max-w-2xl` para destinador com lista de vínculos).
- Garantir que os novos modais (`QuickResiduoDialog`, `QuickTratamentoDialog`) não apliquem `max-w` muito restrito.

## Detalhes técnicos

**Mudanças em `src/lib/data.ts`:**
- `upsertTipoResiduo` retorna `TipoResiduo` (insert com `.select().single()`); update mantém retorno do registro atualizado.
- `upsertTratamento` retorna `Tratamento` analogamente.
- (Opcional) helper `linkResiduoToDestinadores(tipo_id, destinador_ids[], tratamento)` que itera `addDestinadorResiduo`.

**Arquivos novos:**
- `src/components/QuickResiduoDialog.tsx`
- `src/components/QuickTratamentoDialog.tsx`

**Arquivos editados:**
- `src/components/ColetaForm.tsx` — filtro de tipos por vínculos, alerta agregado com botão, autocomplete `onCreate` em resíduo/tratamento, override de tratamento ao escolher resíduo, remover auto-vinculação silenciosa.
- `src/lib/data.ts` — retornos dos upserts.
- `src/components/QuickEntityDialog.tsx` — relaxar `max-w-lg` (cap 90vw já vem do Dialog).
- `src/routes/cadastros.tsx` — se chamadas existentes a `upsertTipoResiduo`/`upsertTratamento` ignoram retorno, nenhuma mudança necessária; verificar para não quebrar.

**Não alterado:** schema do banco, lógica de DMR, importação em massa, indicadores de risco.
