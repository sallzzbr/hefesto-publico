# Héstia — Economia Doméstica

> Plugin de orçamento doméstico. O nome vem de Héstia, a deusa grega do lar e da lareira — aqui mora o controle dos gastos da casa, em português e em BRL.

Filosofia da fase atual: **entender antes de controlar**. O plugin registra bem (despesas, receitas, recorrências) e analisa com números; sugestões — inclusive de orçamento por categoria derivado do teu padrão real — virão do histórico acumulado. Nada de limite imposto pela IA.

## Skills

| Skill | O que faz |
|---|---|
| `orcamento` | O livro: lançar despesa/receita, abrir o mês (recorrências em lote), gerenciar recorrências, status com saldo, fechar o mês. Toda escrita é confirmada antes. |
| `analisar-gastos` | O entendimento do orçamento: evolução por categoria, médias e variações fora do padrão, recorrências × realidade. 100% leitura; descreve, não prescreve. |
| `mercado` | A ingestão do supermercado: registra notas (foto do cupom, PDF/print ou ditado), casa itens com o catálogo vivo de produtos e oferece lançar no orçamento agrupado por categoria. |
| `analisar-mercado` | O entendimento item a item: evolução de preço unitário por produto/marca, quantidades fora do teu padrão semanal, e pesquisa de preço online sob demanda. 100% leitura. |
| `investimentos` | A carteira: movimentos (aporte/resgate/provento), posições atualizadas por print da corretora (com snapshots históricos), ativos e metas declaradas por você. |
| `analisar-investimentos` | O pensamento: visão da carteira, extrato de proventos & rendimento, evolução, acompanhamento de metas e simulações em 3 cenários com premissas explícitas. Leitura + matemática. |

## Commands

- `/hestia:lancar` — registra despesa ou receita ("352,90 mercado crédito", "receita 5000 salário").
- `/hestia:abrir-mes` — lança as recorrências do mês em lote, com uma confirmação e sem duplicar.
- `/hestia:recorrencias` — lista/adiciona/edita/remove contas fixas, assinaturas e parcelamentos.
- `/hestia:status` — receitas, despesas, saldo do mês, quebra por categoria e comprometido restante.
- `/hestia:analisar` — análise histórica do orçamento (evolução, variações fora do padrão). Só leitura.
- `/hestia:fechar-mes` — fechamento do mês com saldo e taxa de poupança. Só leitura.
- `/hestia:nota` — registra uma nota de supermercado (foto/PDF/ditado) e oferece o lançamento agrupado no orçamento.
- `/hestia:catalogo` — gerencia o catálogo de produtos (renomear, fundir, ajustar categoria/apelidos).
- `/hestia:mercado` — análise das compras: preços, quantidades vs padrão, visão do mês. Só leitura.
- `/hestia:preco` — pesquisa preço online (Amazon, Mercado Livre, mercados da região) e compara com o que você pagou.
- `/hestia:carteira` — registra movimentos, atualiza posições com print da corretora e gerencia ativos.
- `/hestia:meta` — cria/edita/conclui metas de investimento e planeja o aporte com simulação.
- `/hestia:investimentos` — análise: carteira, proventos & rendimento, evolução, metas. Só leitura.
- `/hestia:simular` — projeções e objetivos com juros compostos, 3 cenários, premissas explícitas.

## Pré-requisito

Um **conector do Google Drive** ativo (Cowork ou Claude Code). É ele quem lê e escreve os arquivos; este plugin é só o conjunto de instruções de como organizar os dados.

## Instalação

    /plugin marketplace add sallzzbr/hefesto
    /plugin install hestia@hefesto

## Onde ficam os dados

No seu Google Drive. Nada financeiro é versionado no repositório. A pasta-base é
**configurável** e se resolve por uma regra única (documentada em
`skills/orcamento/references/defaults.md`): campo `local_dados` na seção `## Paths do
workspace` do `CLAUDE.md` do repositório atual → `local_dados` dos defaults do usuário
(`~/.claude/hestia/defaults.md`) → default `Financas/hestia/`. As subpastas por domínio são
fixas (`orcamento/`, `mercado/`, `investimentos/`); os paths abaixo citam o default
ilustrativamente.

**Livro do mês** — um CSV por mês (`AAAA-MM.csv`), separador `;`, vírgula decimal:

```
data;tipo;categoria;descricao;valor;metodo
2026-06-01;receita;Salário;Salário do mês;8500,00;transferência
2026-06-03;despesa;Alimentação;Compra no mercado;352,90;crédito
```

**Cadastro de recorrências** — `recorrencias.csv` (fixas e parcelamentos; `parcelas_restantes` vazio = fixa):

```
nome;tipo;categoria;descricao;valor;dia;metodo;parcelas_restantes
Aluguel;despesa;Moradia;Aluguel do apartamento;2800,00;5;pix;
Sofá 6x;despesa;Casa;Parcela do sofá;416,67;10;crédito;4
Salário;receita;Salário;Salário mensal;8500,00;1;transferência;
```

**Mercado & itens** — em `Financas/hestia/mercado/`: itens por mês (`AAAA-MM-itens.csv`) e o catálogo vivo (`produtos.csv`):

```
data;mercado;produto;quantidade;unidade;valor_unitario;valor_total
2026-07-12;Pão de Açúcar;Arroz Camil 5kg;1;un;18,90;18,90
```

```
produto;tipo;marca;categoria;unidade_base;apelidos
Arroz Camil 5kg;arroz;Camil;Alimentação;kg;ARROZ AGULH CAMIL T1 5KG
```

O `produto` dos itens é sempre o nome canônico do catálogo; os `apelidos` acumulam os nomes crus das notas para os próximos casamentos serem automáticos. A `categoria` de cada produto é a do orçamento — é ela que agrupa o lançamento da nota no livro.

**Investimentos** — em `Financas/hestia/investimentos/`: `carteira.csv` (estado atual por ativo), `movimentos.csv` (aportes/resgates/proventos, append-only), `snapshots.csv` (série histórica de saldos, append-only) e `metas.csv` (metas declaradas por você):

```
ativo;classe;instituicao;indexador;vencimento;quantidade;saldo;atualizado_em
meta;valor_alvo;data_alvo;aporte_mensal_planejado;criada_em;observacao
```

### Guardrail de investimentos

Nas skills de investimento, a IA **educa, registra, calcula e simula** — e opina **somente quando você pede**, apenas sobre alocação entre classes, sempre com o disclaimer de que não é assessoria. Nunca: recomendar ativo/corretora específicos, dizer compre/venda, ou prever mercado. Nas demais skills do plugin vale a regra dura: nenhum conselho de investimento.

### Compatibilidade e migração

- **Cabeçalho antigo (0.2.0, sem `tipo`)**: a skill lê como só-despesas e oferece atualizar o arquivo — com confirmação, nunca sozinha.
- **Caminho antigo (`economia-domestica`)**: quem tem dados no caminho legado (`local_dados_legado`, default `Financas/economia-domestica/budget/`) é lido por fallback, com oferta de migração por cópia confirmada (nunca apaga os originais). Escritas novas vão sempre para a pasta resolvida.

## Backlog do produto

A Fase 2 do produto (orçamento ampliado → mercado & itens → investimentos) está concluída. Evoluções registradas:

1. **Orçamento sugerido** — com 4+ meses de histórico, a `analisar-gastos` passa a oferecer sugestão de orçamento por categoria (sugestão, nunca limite).
2. **Lista de compras sugerida** — itens recorrentes + preços de referência a partir do histórico de mercado.
3. **Abertura automática do mês e lembrete de posições** — via schedules (Fase 9 do megaplano do ecossistema).

Specs em `docs/superpowers/specs/` do repo (`2026-07-22-hestia-orcamento-ampliado-design.md`, `2026-07-23-hestia-mercado-itens-design.md` e `2026-07-23-hestia-investimentos-design.md`).

## Aviso

Este plugin acompanha gastos, receitas e orçamento. Ele **não** dá recomendação de investimento; decisões financeiras são suas.
