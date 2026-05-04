# Plano de evolução do sistema (8 fases)

Vou agrupar todas as mudanças em fases coerentes, cada uma entregável e testável de forma independente. Nada será dividido entre mensagens — cada fase será executada inteira quando aprovada. Você pode aprovar este plano e pedir para executar tudo de uma vez, ou fase por fase.

---

## Fase 1 — Histórico global + UX clicável

**Histórico de alterações**

- Mover acesso ao Histórico do botão da página de Coletas para o **menu lateral** (`AppShell.tsx`), com ícone próprio.
- Registrar **todas as ações do sistema** (cadastros, edições, merges, importações, DMR, exclusões, rollbacks de qualquer entidade) — não só coletas.
- O modal passa a ter seletor de unidade: "Todas as unidades" (padrão) ou unidade específica.
- Limite passa a ser **15 por unidade** (consulta por unidade quando filtrado; quando "Todas", mostra 15 por unidade agrupadas por seção).
- Quando uma entrada afeta **1 único registro**, mostrar botão **"Ver registro"** que abre modal lado-a-lado: estado anterior (snapshot) × estado atual, com ações **"Editar atual"** e **"Reverter para anterior"**.
- Rollbacks em massa passam a rodar em **background** com barra de progresso (reaproveitar infra do `import-job.ts`, generalizando para "long-running jobs").

**UX de clicabilidade**

- Em `src/styles.css` / classes utilitárias: garantir `cursor-pointer` em todo elemento clicável (botões, badges interativas, linhas de tabela com ação, ícones).
- Adicionar micro-animação padrão (`hover:scale-[1.02] active:scale-[0.98] transition`) nos botões via variante do `Button`.

---

## Fase 2 — Filtros avançados de Coletas + visualização multi-unidade

**Reestruturação dos filtros (`coletas.index.tsx`)**

- Remover os 3 `MultiSelectFilter` (resíduo/destinador/transportador) e os botões rápidos de filtro.
- Manter busca livre e **ordenação por cabeçalho** (não alterar).
- Novo botão **"Filtro avançado"** abrindo painel/sheet com regras compostas:
  - Campo (data, mtr, resíduo, destinador, transportador, peso, observações, unidade, status)
  - Operador (igual, contém, começa com, maior que, menor que, entre, vazio, não vazio)
  - Valor (input adequado ao tipo; data = `De DD/MM/AAAA → A DD/MM/AAAA`)
  - Múltiplas regras com AND/OR
- Botão **"Filtros salvos"** ao lado: salvar conjunto atual com nome, listar, aplicar, excluir. Persistência em nova tabela `filtros_salvos` (user-less, por unidade ou global).

**Multi-unidade**

- Toggle no topo: **"Apenas unidade ativa"** (padrão) × **"Todas as unidades"**.
- Quando "Todas": adicionar coluna **Unidade** na tabela; respeitar período do menu lateral.
- **Remover coluna "Trimestre"**.
- Ações de linha: manter **lápis (Editar)** e adicionar **lixeira (Excluir)** com confirmação simples.

**Formato de peso**

- `formatKg` na tabela de coletas passa a sempre exibir em **kg** (sem conversão automática para t). Demais telas (DMR, consolidação) mantêm comportamento atual.

---

## Fase 3 — Indicadores de risco unificados + dashboard de risco

**Sistema de severidade**

- Criar helper `getColetaRiscos(coleta)` retornando array de riscos com nível:
  - Sem MTR por erro de preenchimento → **amarelo**
  - Sem MTR por operação (DMR manual) → **laranja**
  - Sem peso (peso 0 ou nulo em qualquer item) → **vermelho**
  - Peso estimado → **amarelo**
  - MTR duplicado → **amarelo**
  - Volume fora da DMR → **laranja**
- Na tabela de coletas e em qualquer listagem: **um único ícone de exclamação**, cor = maior severidade. Tooltip lista todos os riscos.

**Dashboard de risco (`risco.tsx`)**

- Contabilizar **peso 0 / nulo como "Sem peso"** (hoje só aparece em pendências).
- Garantir que pendências e dashboard usem o mesmo helper.

---

## Fase 4 — Wizard de importação melhorado

**Conflitos**

- Reduzir opções por linha para **"Substituir"** ou **"Ignorar"** (remover "Manter existente" redundante).
- Barra superior com ações em massa:
  - Substituir todos / Ignorar todos
  - **Substituir onde {campo} {operador} {valor}**
  - **Ignorar onde {campo} {operador} {valor}**

**Detecção de duplicatas sem MTR**

- Quando MTR vazio, comparar (data + resíduo + destinador + transportador + tratamento + peso) — ignora observações.
- Marcar como **"Possível duplicata"** e exibir tela lado-a-lado: importada × existente, ambas editáveis antes de confirmar.

**Detecção "estimado" em observações**

- Regex tolerante a acentos/typos: `/est[ií]m[ao]?d?[ao]?s?/i` aplicado ao campo observações → marca `peso_estimado = true` automaticamente.

**MTR = "DMR" / "DRM" / variações**

- Regex `/^d[mr]{2}$|incluir.*dmr/i` → trata como `dmr_manual = true`, MTR vazio.
- Mostrar tabela resumo dessas linhas com ação "Sem MTR / Incluir na DMR" ou "Editar manualmente".
- **Não agregar** em uma única coleta: cada linha vira coleta separada — exceto quando data + destinador + transportador batem (aí agrupa itens).

**Cadastro inline durante importação**

- Ao clicar **"Adicionar novo"** numa entidade ausente, abrir o **modal completo** da entidade:
  - Resíduo → modal com tratamento padrão e código IBAMA
  - Destinador → modal com CNPJ + tipos de tratamento aceitos
  - Transportador → modal com CNPJ
- Se houver N novos a cadastrar, abrir modais sequencialmente com contador **"1/N", "2/N"…** no botão de avançar. Se N=1, só "Continuar".
- Não perder progresso do wizard.

**Validação de CNPJ**

- Ao cadastrar transportador/destinador (em qualquer fluxo): consultar duplicidade de CNPJ **dentro da mesma entidade** (transportador e destinador são independentes).
- Se duplicado: mensagem **"CNPJ já cadastrado, clique aqui para ver"** → abre modal de edição do existente.

---

## Fase 5 — Cadastros: vínculos automáticos, merge ampliado, exclusão inteligente

**Vínculos automáticos**

- Ao salvar coleta com resíduo não vinculado ao destinador: criar vínculo em `destinador_residuos` automaticamente e disparar **toast** "Resíduo X vinculado ao destinador Y". Funciona para múltiplos itens.

**UI de resíduos por destinador**

- Mostrar apenas vinculados + botão **"Expandir lista"** revelando todos.

**Validação dura nos autocompletes**

- `Autocomplete` usado em `ColetaForm`: ao perder foco com valor não existente em (resíduo, tratamento, destinador, transportador), abrir automaticamente o modal de cadastro pré-preenchido. Só aceita o valor se cadastrado.

**Edição em cascata**

- Ao renomear resíduo / destinador / transportador / tratamento no cadastro: `UPDATE` em todas as coletas e itens que usam o nome antigo (já existe via `_id`, mas o **nome textual** em `coleta_itens.tipo_residuo_nome` / `coletas.destinador` / `coletas.transportador` precisa ser propagado). Implementar com transação SQL.

**Merge ampliado**

- Hoje só transportador e destinador. Adicionar merge para **resíduos** e **tratamentos**.
- Botão "Unificar duplicados" disponível também ao **editar** o item (não só na lista).
- Confirmação destacada: **"Esta ação não pode ser desfeita"**, mas registrar no histórico.

**Exclusão com transferência**

- Ao excluir unidade/resíduo/tratamento/transportador/destinador com dados associados: dialog perguntando **"Transferir dados para outro {tipo}?"** com dropdown dos existentes.
- Se transferir: mover coletas/itens/vínculos; ignorar duplicatas (vínculos que já existem no destino).
- Se não transferir: coletas afetadas perdem o vínculo e entram em **Pendências**.

---

## Fase 6 — DMR melhorada (parsing IBAMA + cadastro inline + drilldown)

**Match por código IBAMA**

- Resíduos ganham campo `codigo_ibama` (já existe `codigo` em `tipos_residuo` — reutilizar e renomear semanticamente).
- Ao casar resíduo da DMR: `dmrResiduo.startsWith(tipo.codigo_ibama)` (não "contém").
- Exemplo: "200138 - madeira não abrangida..." casa com tipo cujo código é `200138`.

**Resíduos não cadastrados na DMR**

- Mesmo fluxo da importação de coletas: lista os ausentes, opção **"Substituir por existente"** ou **"Criar novo"** (modal completo, com contador N/N).

**Editar resíduo a partir da DMR**

- Clicar em resíduo interno na DMR: abre modal de edição do tipo de resíduo (incluindo código IBAMA).
- Ao salvar: propagação em cascata (Fase 5) para todas coletas/itens.

**Drilldown**

- Adicionar ordenação por data.
- Botões de filtro: **Todas**, **Peso estimado**, **Sem MTR**.

---

## Fase 7 — Coleta: merge/import com validação cruzada de MTR

**Detecção em merge**

- Ao fazer merge de transportador/destinador, se houver coletas com MTR já presente em outra coleta do sistema: avisar e abrir comparativo lado-a-lado, opção de editar uma das duas.

**Duplicata sem MTR no merge/import**

- Mesma regra da Fase 4 (data + resíduo + destinador + tratamento bateram → duplicata).

---

## Fase 8 — Correção do bug crítico de DMR em toneladas

Já foi corrigido em fase anterior — fazer **revisão + testes**:

- Conferir que valores como "2,7" continuam virando 2.7 t (não 270 t).
- Adicionar testes unitários simples em `parseTonelada` para os formatos: `2,7`, `1.234,56`, `1234.56`, `2700`.

---

## Mudanças de banco previstas

```sql
-- Fase 1: histórico global (audit_log já existe; permitir unidade_id null = global)
-- Já está null-able; ajustar apenas listAuditLog para agrupar por unidade.

-- Fase 2: filtros salvos
CREATE TABLE filtros_salvos (
  id uuid PK, nome text, escopo text, -- 'coletas'
  unidade_id uuid NULL, regras jsonb, criado_em timestamptz
);

-- Fase 6: garantir tipos_residuo.codigo_ibama (usar coluna 'codigo' existente; documentar)
```

Sem mudanças destrutivas. RLS mantida como `public all` (modo atual do projeto).

---

## Garantias

- Cada fase é independente: rollback de uma não quebra as outras.
- Funcionalidades existentes (ordenação por cabeçalho, importação em background, rollback de import, formato BR de números, etc.) **não serão alteradas** exceto onde explicitamente listado.
- Testes manuais sugeridos ao fim de cada fase: checklist por bullet.

---

**Como prosseguir:** Faça 2 fases por vez.