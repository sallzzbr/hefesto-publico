---
description: "Score campaign efficiency and propose a budget reallocation plan. Use when the user wants to redistribute ad spend, decide what to scale or cut, or check monthly pacing — otimizar verba, realocação de orçamento, efficiency score, pacing do mês, onde colocar o dinheiro."
---

# Otimizar Verba

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Calcula um **Efficiency Score** por campanha, propõe plano de realocação de verba com a
matemática à mostra, e confere o **pacing** do mês contra o alvo. **Só recomenda — nunca
aplica**: mudança de verba é decisão humana.

## Efficiency Score

Por campanha (período: mês corrente, level=campaign, leitura pura):

- Com CPA disponível: `score = (CAC alvo ÷ CPA real) × 100`
- Sem compras (topo de funil): variante por ROAS: `score = (ROAS real ÷ ROAS alvo) × 100`
- **CAC alvo e ROAS alvo por lookup** do `unit-economics` mais recente do workspace (cite o
  arquivo/mês) — nunca de memória.
- **Boost fora da régua:** campanha que NÃO otimiza por conversão (boost/impulsionamento e
  afins) não recebe score nem entra em CPA/ROAS médios — identifique pelo
  `optimization_goal` (e pelo objetivo da campanha), NUNCA pelo nome da entidade; o gasto
  total real aparece no relatório numa linha própria, rotulada. Gasto sem compra no
  denominador contamina a régua e derruba decisão boa.

| Score | Leitura | Ação candidata |
|---|---|---|
| > 100 | entrega abaixo do CAC alvo | **escalar** |
| 80–100 | saudável | manter |
| 60–79 | pagando caro | reduzir |
| < 60 | queimando margem | **pausar** (candidata) |

## Guardas (antes de qualquer recomendação)

- **Learning phase**: campanha/conjunto com < 7 dias desde a última edição significativa ou
  < 50 eventos de otimização → não mexe (mexer reseta o aprendizado).
- **Escala com sinal**: escalar só com ≥ 10 conversões no período.
- **Incrementos**: subir em passos de R$5 ou 10% (o que for maior); **nunca cortar > 50%**
  de uma vez (choque de verba derruba a entrega do que sobrou).
- Campanha sem gasto mínimo (default R$50 no período) → "dados insuficientes".

## Pacing do mês

`esperado_MTD = (verba_mensal ÷ dias_do_mês) × dias_decorridos`. Real < 80% do esperado =
subinvestindo (a meta do mês não fecha); > 120% = queimando adiantado. Aponte a causa
(campanha pausada? CPM subiu?) e o ajuste.

## Saída

Relatório em `marketing/inteligencia/budget-optimizer/AAAA-MM-DD.md`: tabela por campanha
(gasto, CPA/ROAS, score, ação candidata **com a conta à mostra**), plano de realocação
(de onde → pra onde → quanto → por quê), pacing, e a lista do que NÃO mexer (learning
phase). IDs sem entrada no registry local do workspace → sinalize pra registrar.

**Trade-off no plano de realocação:** quando a recomendação envolver criar conjunto novo,
avalie antes entrar como **anúncio novo em conjunto existente compatível** — evita reset de
learning e não aumenta a verba total; conjunto novo só quando o público/argumento exige
separação (e nasce com ≥2 anúncios, nunca 1).

## Regras

- **Somente leitura na plataforma.** Recomendação ≠ execução; quem aplica é o humano.
- Sempre mostrar a matemática (score e incrementos calculados na frente do leitor).
- Português BR; valores em BRL.
