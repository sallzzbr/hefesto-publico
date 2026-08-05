---
description: "Detect creative fatigue vs concept weakness in running ads and produce a per-ad action plan. Use when the user wants to know which ads to kill, scale or iterate — fadiga criativa, anúncio cansou, CTR caindo, plano KILL/SCALE/ITERATE, saúde dos criativos."
---

# Fadiga Criativa

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Compara cada anúncio ativo contra o **período imediatamente anterior** e devolve um plano de
ação por anúncio: **KILL / SCALE / ITERATE / TEST NEXT**. O coração é distinguir dois
problemas com o mesmo sintoma (CTR caindo) e correções opostas.

## A definição operacional (as 3 condições, TODAS verdadeiras)

Um anúncio está **fadigado** quando:

1. **Frequência > 3,0** no período atual, E
2. **CTR caiu > 15%** vs período anterior (`CTR_atual / CTR_anterior < 0,85`), E
3. Está rodando há **> 7 dias**.

Só 1-2 condições = observar, não agir. E o contraste central:

- **Fadiga** (audience-side): o criativo JÁ provou que funciona — a audiência que cansou →
  **ITERATE** (variação via `hermes:evoluir-vencedor`) ou público novo. Matar joga fora um
  conceito validado.
- **Fraqueza** (concept-side): CTR ruim **desde o dia 1**, frequência ainda baixa → **KILL**.
  Iterar em cima não salva conceito que nunca conectou.

## Protocolo

1. **Duas janelas** iguais e adjacentes (default: últimos 7d vs 7d anteriores) via MCP da
   plataforma, level=ad, leitura pura. Gasto mínimo no período (default R$100) pra opinar;
   abaixo, "dados insuficientes". **Métrica acumulada não é métrica diária:** métrica
   ACUMULADA do período (ex.: frequência MTD) cresce por definição — nunca a use como proxy
   de leitura diária nem como evidência de fadiga. Fadiga só se lê em janelas IGUAIS e
   ADJACENTES: CTR caindo COM frequência subindo na MESMA janela.
2. **Guarda de learning phase**: anúncio com < 7 dias desde a última edição significativa ou
   < 50 eventos de otimização → não julgue; marque "em aprendizado".
3. **Tiers**: vencedores (top 25% ROAS), perdedores (bottom 25% CPA), medianos. Compare
   também por formato quando a amostra permitir.
4. **Réguas por lookup**: CAC alvo/máximo e ROAS do `unit-economics` mais recente do
   workspace — cite o arquivo/mês usado; **nunca** números de memória.
5. **Plano por anúncio**: ação (KILL / SCALE / ITERATE / TEST NEXT) + o número que a
   justifica + a régua ao lado ("CPA R$X vs alvo R$Y") + próximo passo concreto (pausar é
   decisão humana; esta skill só recomenda).
6. **Grave** em `marketing/inteligencia/fadiga-criativa/AAAA-MM-DD.md`; atualize status no
   registry de criativos do workspace quando ele existir (trilha de decisão).

## Regras

- **Somente leitura na plataforma** — nenhuma pausa/edição automática; execução é humana.
- Sempre mostrar a régua ao lado do número (número solto não decide nada).
- SCALE só com ≥ 10 conversões no período e CPA ≤ alvo (escalar cedo destrói o sinal).
- Português BR.
