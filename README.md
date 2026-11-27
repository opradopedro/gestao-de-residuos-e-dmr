# Waste Guardian

Crie uma aplicação SaaS completa para gestão, validação e reconciliação de dados de resíduos com foco na conferência da DMR (Declaração de Movimentação de Resíduos).

A aplicação deve suportar múltiplas unidades operacionais com separação total de dados. Cada unidade deve possuir suas próprias coletas, dashboards, pendências e análises de DMR. Em hipótese alguma os dados de diferentes unidades podem ser misturados.

Estruture o sistema com as seguintes entidades e relações:

- Unidade (id, nome)

- Coleta (id, data, unidade_id, transportador, destinador, mtr, peso_estimado (boolean), observacoes)

- Item da coleta (id, coleta_id, tipo_residuo, peso, tratamento)

Regras obrigatórias:

- Uma coleta pertence a uma única unidade

- Uma coleta pode ter vários itens

- Peso é obrigatório em cada item

- O MTR pode se repetir entre itens da mesma coleta

- O campo observações deve ser livre e editável

- Deve existir flag de peso estimado na coleta

Base de dados:

- Criar uma lista interna de tipos de resíduos

- Cada resíduo deve ter um tratamento padrão associado

- O sistema deve sugerir automaticamente o tratamento ao selecionar o resíduo, mas permitir edição manual

Regras de negócio:

- Coletas sem MTR devem ser consideradas pendências

- Coletas com peso estimado devem ser consideradas pendências até validação

- Validar pesos fora do padrão (valores extremamente altos)

- Detectar possíveis duplicidades de MTR (permitindo repetição dentro da mesma coleta)

Funcionalidades principais:

1. Cadastro de coletas:

- Data padrão = hoje (editável)

- Seleção obrigatória de unidade

- Possibilidade de adicionar múltiplos resíduos na mesma coleta

- Campo de observações

- Checkbox para peso estimado

- MTR opcional

2. Gestão de pendências:

- Listar coletas sem MTR

- Listar coletas com peso estimado

- Mostrar quantidade e peso total dessas pendências

- Exibir impacto: "X toneladas fora do sistema oficial"

3. Consolidação de dados:

- Agrupar dados por tipo de resíduo e destinador

- Somar pesos automaticamente

- Sempre considerar separação por unidade

4. Organização por trimestre:

- O sistema deve automaticamente organizar os dados em janelas de 3 meses

- Exemplo: Jan-Fev-Mar

- Essa estrutura deve ser usada para análise e exportação

5. Exportação:

- Gerar planilhas separadas por trimestre

- Permitir download

- Separar por unidade

6. Módulo de DMR:

- Permitir upload de Excel

- Ler dados da DMR

- Comparar com dados internos

- Agrupar por tipo de resíduo e destinador

- Mostrar divergência de peso

- Sugerir causas:

  - coletas sem MTR

  - peso estimado não corrigido

7. Funções do sistema:

- Criar coleta

- Atualizar MTR depois

- Listar por unidade

- Listar pendências

- Calcular totais

- Comparar com DMR

O sistema deve ser estruturado de forma limpa, escalável e pronta para evoluir para funcionalidades futuras como usuários e auditoria.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gestao-de-residuos-e-dmr.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/70db2a74-2843-4b69-88cf-11ce5d2c06b6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
