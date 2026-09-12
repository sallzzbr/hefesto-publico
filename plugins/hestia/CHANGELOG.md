# Changelog — hestia

> Histórico anterior à 0.12.2 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

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
