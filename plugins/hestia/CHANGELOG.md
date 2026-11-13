# Changelog — hestia

## 0.13.3

Fixtures com procedência incerta substituídas por cenário sintético explícito; procedência documentada nos testes.

> Histórico anterior à 0.12.2 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

## 0.13.2

- Sinaliza possíveis proventos históricos classificados como Investimentos no resumo e na análise entre meses, com totais provisórios e classificação pendente. Mantém dados e cálculos originais até decisão e correção autorizada; nunca migra lançamentos automaticamente.

## 0.13.1

- Alinha a descrição de recorrências na abertura e distingue estimativa do relatório de reconciliação pelo journal.

## 0.13.0 (2026-11-02)

Decisões do dono sobre os achados HES-05 e HES-04 da revisão de 2026-11-01. Muda cálculo e
formato, por isso minor.

- Aporte e resgate são transferências com o próprio patrimônio, não gasto nem renda. A despesa na
  categoria `Investimentos` (espelho de aporte) sai das despesas, da quebra por categoria e das
  maiores despesas e aparece em linha própria, `investido_no_mes` (com a lista `aportes`). A
  receita nessa categoria (espelho de resgate) sai das receitas e aparece em `resgatado_no_mes`
  (com a lista `resgates`). O `saldo` virou `saldo_em_caixa` = receitas mais resgates menos
  despesas menos aportes; a taxa de poupança passa a ser `poupanca_do_mes` / receitas, com
  `poupanca_do_mes` = receitas menos despesas: o aporte conta como poupança e o resgate não conta
  como renda. Receita 8500, aluguel 3000 e aporte 2000 dão 64,71%, e não mais 41,18%; resgate e
  aporte de 10000 no mesmo mês (rebalanceamento) continuam dando 64,71% e caixa de 5500, em vez
  de contar o mesmo dinheiro duas vezes (83,78%); resgate de 2000 sem aporte dá 64,71% e caixa
  de 7500. Mês cuja única entrada é resgate não tem taxa, com motivo. O `gastos.py` aplica a
  mesma regra na visão do mês, tira o aporte da evolução, das variações fora do padrão, das
  categorias novas e das maiores mudanças, e traz as séries `aportes_por_mes` e
  `resgates_por_mes`. A comparação com o mês anterior volta a trazer a poupança
  (`poupanca_anterior`, `poupanca_delta`, `taxa_de_poupanca_anterior_pct`, nula com motivo sem
  receita) ao lado do caixa e de `investido_*` e `resgatado_*`: o "saldo R$ X acima de maio" da
  skill é a poupança, e a queda do caixa explicada pelo aporte maior não é piora. Receita que não
  é resgate (provento, dividendo) vai em outra categoria.
- Cada nota de mercado tem identidade própria: coluna `nota` no fim do `AAAA-MM-itens.csv`, no
  formato `AAAA-MM-DD-N`. A descrição do lançamento passa a ser `Mercado <nome> (nota <id>)` e o
  `nota.py` ganha `--nota`; identificador fora do formato, com data diferente da linha ou repetido
  em outra compra para com erro. Arquivo sem a coluna continua lido pela identidade antiga
  (data, mercado), sem identificador inventado e com a descrição antiga, e o lançamento dele só é
  proposto com `--nota-unica-confirmada`, depois de o usuário confirmar que a seleção é uma nota
  só. A skill oferece migrar o cabeçalho, com confirmação. No arquivo migrado, a compra antiga
  (com `nota` vazia) que divide mercado e dia com uma compra identificada se seleciona com
  `--sem-nota`, combinável com `--data`/`--mercado` e ainda sujeito à confirmação de nota única,
  e sai com a descrição antiga; `--nota` vazio e `--nota` com `--sem-nota` param com erro, e o
  motivo do lançamento recusado indica o filtro que isola cada nota.

## 0.12.5 — 2026-09-09

- Rendimento usa a janela efetiva de snapshots por ativo, informa fluxos externos e recusa ordem intradiária incerta. Ritmo de metas não replica fluxo global entre potes: cadastro com várias metas exige recorte declarado para uma meta, preservando progresso sem projeção quando ausente.

## 0.12.4 — 2026-09-06 (correções dos testes Codex)

- Análise de mercado exclui linhas sem quantidade/preço unitário das comparações e informa os campos ausentes, preservando o gasto. Quantidades e desvios usam a unidade-base do catálogo, explicitada no resultado. Quantidades pequenas preservam precisão suficiente para não aparecerem como zero.

## 0.12.3 — 2026-09-05 (preparação para teste Claude)

- Abertura de mês confirma o efeito completo e registra estados antes/depois em journal para detectar e reconciliar gravações parciais. Os CSVs existentes mantêm o formato; o conector continua sem transação entre arquivos.
- `name` explícito em todas as skills, alinhado ao diretório.

## 0.12.2 — 2026-09-02 (milhar com ponto sem centavos)

Correção da auditoria adversarial de 2026-09-01, reproduzida pelos dois revisores.

- `scripts/brl.py`: `"R$ 1.500"` era lido como `1.500` — um real e cinquenta. O ponto só
  virava milhar quando havia vírgula. Agora `-?[1-9]\d{0,2}(\.\d{3})+` sem vírgula é milhar;
  `0.500` (quantidade) e `1234.56` seguem decimais. O caminho real era a CLI do
  `juros_compostos.py` (`--inicial`, `--aporte`, `--alvo`), que recebe texto do usuário ou do
  modelo; o CSV do orçamento exige vírgula e não era afetado.
- `brl()` passa a recusar explicitamente o formato EN `1,234.56` (o docstring já prometia; a
  ordem dos replaces lia como 1234,56).
- Docstring de `tributar_por_tranche` dizia `meses * 30`; o código usa 365/12 desde a revisão
  anterior.
- Teste novo `tests/test_brl.py` (23 casos) — o parser de dinheiro não tinha teste direto.
