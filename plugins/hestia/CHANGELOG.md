# Changelog — hestia

> Histórico anterior à 0.12.2 vive nos commits do repositório privado; o espelho público nasce
> com histórico fresco a cada release, e este arquivo é o que sobrevive à travessia.

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
