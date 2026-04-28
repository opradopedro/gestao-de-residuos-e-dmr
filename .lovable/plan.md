## Contexto

A aplicação já tem toda a estrutura funcional pedida (sidebar, dashboard, coletas, pendências, DMR, consolidação, cadastros). Este plano foca em **alinhar o design e a experiência operacional** ao briefing: paleta branco/azul/verde, filtro global de período, dashboard de risco dedicado e refinamentos de usabilidade.

## 1. Nova paleta (src/styles.css)

Trocar o tema atual (verde dominante) pela paleta solicitada:

- **Fundo:** branco puro / cinza muito claro
- **Primary (ações, links, botões):** azul (`oklch(0.55 0.18 255)`)
- **Success (indicadores positivos, "tudo certo"):** verde (`oklch(0.62 0.17 150)`)
- **Warning (peso estimado, risco médio):** amarelo âmbar (`oklch(0.80 0.16 80)`)
- **Destructive (sem MTR, fora da DMR, risco alto):** vermelho (`oklch(0.58 0.22 25)`)
- **Sidebar:** branco com borda sutil; item ativo em azul claro
- Bordas mais suaves, cards com sombra leve em vez de só borda

## 2. Filtro global de período (src/components/AppShell.tsx + novo hook)

Hoje o trimestre é "atual" fixo. Adicionar:

- Novo hook `use-periodo.ts` (ano + trimestre persistido em localStorage)
- Seletor de período no **header da área principal** (ao lado do nome da unidade no mobile, e como barra superior fixa no desktop) — opções: 1º/2º/3º/4º trimestre + ano
- Substituir `currentQuarter()` por `usePeriodoAtivo()` em: `index.tsx`, `pendencias.tsx`, `consolidacao.tsx`, `dmr.tsx`, novo `risco.tsx`
- O período escolhido vira o filtro padrão de **todas** as telas (mantém a coerência multi-unidade já existente)

## 3. Dashboard principal (`/`) — refinamento

- KPIs reorganizados em destaque: total de resíduos, coletas sem MTR, peso estimado, **volume fora da DMR** (calcular comparando com último upload DMR do trimestre, se houver — caso contrário mostrar "—")
- Banner de alerta no topo quando houver risco alto (cor vermelha) ou médio (amarela)
- Gráfico de top resíduos com cores azul/verde da nova paleta
- Atalhos rápidos: "Nova coleta", "Resolver pendências", "Conferir DMR"

## 4. Nova tela: Dashboard de Risco (`/risco`)

Nova rota `src/routes/risco.tsx` com:

- **Score de risco** calculado por regra simples no trimestre selecionado:
  - Alto: >5 coletas sem MTR **ou** >1 t fora da DMR
  - Médio: 1-5 coletas sem MTR **ou** peso estimado >10% do total
  - Baixo: caso contrário
- Cartão grande no topo com badge colorido (vermelho/amarelo/verde) + frase resumo: *"3 coletas sem MTR · 1.2 toneladas fora da DMR"*
- Lista de fatores de risco detalhados (cada item com link para a tela de origem):
  - "Coletas sem MTR" → /pendencias
  - "Peso estimado não confirmado" → /pendencias
  - "Divergências DMR" → /dmr
  - "MTRs duplicados em 90 dias" (regra já existente)
- Item adicionado no menu lateral entre "Pendências" e "Consolidação"

## 5. Tela de Pendências — ações rápidas

- Adicionar **botão "Adicionar MTR"** inline em cada linha sem MTR (abre modal pequeno com input + salvar) em vez de só "Corrigir"
- Adicionar **botão "Confirmar peso"** inline para itens com peso estimado (desmarca a flag `peso_estimado`)
- Mantém o link "Editar coleta completa" para casos complexos

## 6. Tela de DMR — investigação

- Tornar cada linha de divergência **clicável** (abre `Sheet` lateral) listando:
  - Coletas internas que compõem aquele resíduo/destinador no trimestre (com link "Editar")
  - Linhas da DMR que entraram no agrupamento
- Indicador visual mais forte: chips coloridos (verde "OK", amarelo "Divergência leve", vermelho "Divergência grave > 50 kg ou >10%")

## 7. Cadastro de coleta — refinamento

- Layout mais compacto, agrupando: Data + Unidade + Transportador + Destinador + MTR no topo
- Bloco "Resíduos" com botão "+ Adicionar resíduo" mais visível (azul)
- Auto-sugestão de tratamento já existe — destacar visualmente quando aplicada
- Checkbox de "peso estimado" com ícone de aviso amarelo

## 8. Sidebar — pequenos ajustes

- Branco com item ativo em azul claro (alinhado à nova paleta)
- Badge numérico vermelho ao lado de "Pendências" e "Risco" quando houver itens críticos

## Arquivos afetados

```text
EDIT  src/styles.css                 (nova paleta)
EDIT  src/components/AppShell.tsx    (período global no header, badges no menu)
NEW   src/hooks/use-periodo.ts       (ano+trimestre global)
EDIT  src/routes/index.tsx           (KPIs, banner, atalhos, usar período global)
EDIT  src/routes/pendencias.tsx      (ações inline, usar período global)
EDIT  src/routes/dmr.tsx             (Sheet de investigação, chips)
EDIT  src/routes/consolidacao.tsx    (usar período global)
EDIT  src/components/ColetaForm.tsx  (layout compacto)
NEW   src/routes/risco.tsx           (dashboard de risco)
EDIT  src/lib/data.ts                (helper para volume fora da DMR + atualização rápida MTR/peso)
```

## Fora do escopo

- Autenticação / RBAC (mantido para fase futura conforme combinado)
- Mudança de schema do banco (a base atual já suporta tudo)
- Notificações push / e-mails

Após sua aprovação, implemento em uma única sequência e mostro o resultado.