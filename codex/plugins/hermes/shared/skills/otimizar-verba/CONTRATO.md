---
name: otimizar-verba
description: "Score campaign efficiency and propose a budget reallocation plan. Use when the user wants to redistribute ad spend, decide what to scale or cut, or check monthly pacing — otimizar verba, realocação de orçamento, efficiency score, pacing do mês, onde colocar o dinheiro."
allowed-tools: Read, Grep, Glob
---

# Otimizar Verba

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.

> Conectores: esta skill fala em categorias (ver `${CLAUDE_PLUGIN_ROOT}/CONNECTORS.md`); o que é específico do canal vive em `${CLAUDE_PLUGIN_ROOT}/references/adaptadores/meta-ads.md`. Sem conector da categoria, peça o export (CSV) em vez de inventar o número.


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
| < 60 | queimando margem | **pausar** (candidata; vira recomendação só com veredito `pausar` da `regua-decisao`) |

O score ordena a prioridade de revisão; não é veredito. Pausar, manter, escalar e reverter vêm
da `hermes:regua-decisao`, uma chamada por campanha: quando a faixa e a régua divergem (score
"saudável" com CPA acima do CAC breakeven, por exemplo), o veredito da regua-decisao prevalece e
o relatório mostra os dois.

## Guardas (antes de qualquer recomendação)

- **Aprendizado e veredito** pela `hermes:regua-decisao` (fonte única): 7 dias desde a última
  edição significativa + piso de gasto, limiar de eventos só se o workspace configurar. Gatilho
  `aprendizado-*` → não mexe (mexer reseta o aprendizado).
- **Escala com sinal**: escalar só com veredito `escalar` da `regua-decisao` (conversões mínimas e
  intervalo entre degraus vivem lá).
- **Incrementos** (heurística de mercado, não regra de plataforma): subir em passos pequenos ou
  10% (o que for maior; o passo mínimo absoluto, na moeda do perfil, é decisão do usuário: a skill pergunta e não assume valor), **limitados a ~20% por degrau**; o intervalo entre degraus é o
  `intervalo_minimo_degrau_dias` da `regua-decisao` (3 a 7 dias, parâmetro do perfil), e o plano de rampa
  usa o mesmo valor para não propor degrau que a régua mandaria esperar; salto
  acima de 20% a 30% de uma vez reseta o aprendizado. Degrau que piora o CPA volta pela
  decisão `reverter-degrau` da `regua-decisao`. Conjunto novo também paga aprendizado (custo por lookup na doutrina de
  estrutura do workspace). **Nunca cortar > 50%** de uma vez (choque de verba derruba a
  entrega do que sobrou).
- Campanha abaixo do piso de diagnóstico (`piso_diagnostico` da `regua-decisao`, sobrescrevível
  pelo workspace) → "dados insuficientes".
- **Lucro absoluto antes de reduzir ou realocar**: o lucro do período e o lucro por real investido
  de cada campanha saem da `regua-decisao` (`lucro`, de plataforma, com o fator ledger ÷
  plataforma do `pnl-mensal` citado). Mostre os dois antes de reduzir, cortar ou mover verba:
  campanha com retorno menor por real pode dar lucro total maior, e cortá-la só pelo score
  derruba o lucro do mês. A comparação de lucro entre campanhas usa a mesma janela para todas (a
  do relatório); quando a régua pede janela menor para uma delas (edição ou degrau), o veredito
  dela usa a janela da régua e o relatório diz isso.

## Pacing do mês

`esperado_MTD = (verba_mensal ÷ dias_do_mês) × dias_decorridos`. Real < 80% do esperado =
subinvestindo (a meta do mês não fecha); > 120% = queimando adiantado. Aponte a causa
(campanha pausada? CPM subiu?) e o ajuste.

## Saída

Relatório em `marketing/inteligencia/budget-optimizer/AAAA-MM-DD.md`: tabela por campanha
(gasto, CPA/ROAS, lucro do período e lucro por real investido, score, ação candidata **com a
conta à mostra**), plano de realocação
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
