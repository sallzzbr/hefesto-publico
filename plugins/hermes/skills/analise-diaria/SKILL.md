---
description: "Analyze the daily state or create a read-only snapshot of a Meta Ads portfolio — ritual diário nos 3 níveis ou resumo consolidado por período/campanha, sempre com réguas por lookup. Use when o usuário pedir 'análise de hoje', 'análise diária', 'como estão os ads hoje', 'daily ads check', 'snapshot Meta', 'resumo da conta'. Somente leitura; a decisão é sempre do humano."
---

# Análise Diária

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.

Encoda o ritual "análise de hoje" de uma conta Meta Ads: ler o portfólio ativo, montar a
série dia-a-dia do vencedor e dos testes, conferir as réguas de decisão e levantar alertas.
É o complemento diário do briefing semanal — mais raso, mais rápido, **sem mexer em nada**.

**Somente leitura + sugestões.** Nunca altera entidade Meta — nenhum `ads_create_*`,
`ads_update_*`, `ads_activate_entity`, nem "só dessa vez". Toda decisão (pausar, escalar,
manter) é do humano.

## Modos e argumentos

- **Modo diário** (default): ritual operacional de ontem + MTD descrito nos passos 1–6.
- **Modo snapshot**: resumo rápido da conta e das campanhas no período pedido, descrito na
  seção própria abaixo. Aceita `last_7d` (default), `last_14d`, `last_30d`, `maximum`,
  `lifetime` ou range explícito `since/until`.

Se o pedido não distinguir os modos, "hoje", "diária" e "ads rodando" selecionam o modo
diário; "snapshot", "resumo da conta" ou um dos períodos acima selecionam o modo snapshot.

## Contrato de workspace (cola local — a skill NÃO carrega nada disso)

Do workspace vêm: o **id da conta** (CLAUDE.md/registry do workspace), as **réguas vigentes**
(`financeiro/relatorios/unit-economics-*.md` mais recente — ler os números DELE e citar o
arquivo usado; sem relatório, rodar `hermes:unit-economics` antes: régua decorada não entra
no veredito), os **critérios por teste** (`marketing/estrategia/backlog-testes.md`), as
**réguas de estrutura** (doutrina do workspace, ex.: `marketing/meta-ads/`), os **campos
válidos do MCP** (tabela do workspace, se existir; na ausência: `amount_spent`,
`purchase_roas`, `cost_per_result`, `actions:omni_purchase`, `ctr`, `frequency`,
`impressions`, `daily_budget` em centavos) e as **análises anteriores**
(`marketing/inteligencia/analises-diarias/`). Sem workspace de marketing no cwd, **PARE**.

## Passos

### 1. Identificar o portfólio ativo (3 níveis)

`ads_get_ad_entities` em **cascata: campanha → conjunto → ad**, com `effective_status`.
**ACTIVE em campanha não garante entrega** — só conta como "rodando" o ad ACTIVE nos 3
níveis. Saída: lista de ads entregando com ids, verba diária do conjunto e slug local
(cruzar com os `_indice.csv` do registry do workspace).

**Após qualquer ativação em lote** (script, planilha, regra automática): conferir
NOMINALMENTE o que voltou a ACTIVE, item a item — lote ressuscita anúncio pausado de
propósito, e um pausado-por-decisão rodando de novo é regressão silenciosa de decisão
humana. Cruze a lista com o registry e alerte o que não deveria estar rodando.

### 2. Puxar métricas de ONTEM e MTD por ad

Para cada ad ativo, duas chamadas de insights (`level=ad`): ontem (`time_range` com
`since` = `until` = ontem) e MTD (dia 1 do mês até ontem). **Funil completo só quando houver
sinal estranho** (gasto alto sem compra, ATC alto sem fechar): puxar `actions` detalhado
etapa a etapa. Se o MCP não cobrir alguma etapa e o workspace tiver credencial de leitura
própria documentada, use-a conforme as regras do workspace — nunca por fora delas.

**Boost fora da régua:** tráfego que NÃO otimiza por conversão (boost/impulsionamento e
afins) fica FORA de CPA/ROAS/CTR médios e de qualquer veredito — identifique pelo campo
`optimization_goal` (e pelo objetivo da campanha), NUNCA pelo nome da entidade. O gasto
total real sobrevive no relatório numa linha própria, rotulada. Razão: gasto sem compra no
denominador contamina a régua e derruba decisão boa.

### 3. Montar a série dia-a-dia

Ler as análises anteriores e **estender a série** de cada ad acompanhado com o dia de ontem
(gasto, compras, CPA, ROAS, CTR, freq). Primeira execução começa a série (sinalizar).
Julgamento: vendas podem vir **em rajadas** — um dia seco isolado NÃO é sinal de morte; a
janela mínima de avaliação é **7 dias**.

### 4. Conferir réguas e dar veredito por ad

Cruzar cada ad com os critérios do teste (backlog), as réguas gerais (doutrina) e a economia
(CPA vs CAC máximo, ROAS vs breakeven, CPA vs alvo — os três do unit-economics citado).
Sempre mostrar **a régua ao lado do número**. Veredito fechado, só 3 valores:

- **MANTER** — dentro das réguas, sem gatilho batido.
- **OBSERVAR** — sinal divergente sem régua batida.
- **RÉGUA ATINGIDA — DECIDIR** — critério de gasto acumulado batido OU CPA/ROAS estourado
  com janela cumprida. A skill apresenta números e recomendação; **nunca executa**.

Não decretar morte com menos de 7 dias de janela.

### 5. Alertas

- **Fadiga:** CTR caindo vs média da série + frequência subindo no mesmo ad → alertar
  (versão rápida da regra de `hermes:fadiga-criativa` — para o quadro completo, rode a skill).
  **Cuidado com métrica acumulada:** frequência MTD (e qualquer métrica acumulada do
  período) cresce por definição — nunca é proxy de métrica diária nem evidência de fadiga.
  Fadiga só se lê em janelas iguais e adjacentes: CTR caindo COM frequência subindo na MESMA
  janela.
- **Pacing:** gasto MTD vs alvo mensal **vigente do workspace** (estratégia/doutrina — nunca
  um número decorado). Gap ou estouro > 15% vira alerta.
- **Próximos checkpoints:** listar com data, puxando gatilhos do backlog e dos registries.

### 6. Gravar análise + fechar o loop

Salvar em `marketing/inteligencia/analises-diarias/AAAA-MM-DD.md` (append-only, arquivo novo
por data), com: tabela do portfólio (verba, ontem, MTD, CTR, freq, veredito), séries por ad,
tabela de réguas (critério + fonte + acumulado + status), alertas e recomendações. Seguir o
formato das análises anteriores do workspace quando existirem.

**Recomendação relevante → linha no registry** (trilha no `.md` correspondente,
`proxima_acao`/Histórico): se a decisão não virou linha no registry, ela não aconteceu para
o cockpit.

## Modo snapshot

1. Resolva o período pelos argumentos; sem período, use `last_7d`.
2. Consulte insights em `level=account` com `amount_spent`, `purchase_roas`, `results`,
   `actions:omni_purchase`, `ctr`, `cpc`, `cpm`, `impressions`, `reach`, `frequency` e
   `cost_per_result`.
3. Consulte `level=campaign`, ordenado por gasto decrescente, com os mesmos campos mais
   `name`, `status`, `objective` e `daily_budget`.
4. Calcule gasto e compras totais, CPA e ROAS blended. Para cada campanha, mostre gasto,
   compras, CPA, ROAS, CTR e frequência; cruze ids com os registries resolvidos e ponha
   hipótese, critério e régua vigente ao lado do observado. Campanha sem entrada local vira
   alerta explícito — não invente o pareamento.
5. Mostre as cinco campanhas de maior gasto. O gasto mínimo de inclusão vem das regras do
   workspace; na ausência de regra, o default documentado é R$50 no período. Abaixo do
   mínimo, liste separadamente como **dados insuficientes**, sem emitir veredito.
6. Salve em `marketing/inteligencia/snapshots/AAAA-MM-DD-<contexto>.md`, com: período e
   fontes; consolidado da conta; top 5; dados insuficientes; uma observação principal
   sustentada por número; ações apenas sugeridas; e apêndice dos pareamentos de registry.
   O path é ilustrativo e usa a base `local_marketing` já resolvida pela regra única.

Erro de permissão, campo inválido ou período não suportado **interrompe o snapshot e informa
qual chamada falhou**. Nunca troque silenciosamente o período pedido por `last_7d`; só tente
outro período após consentimento explícito do usuário.

## Regras

- Somente leitura no Meta, sempre.
- Sempre conferir os 3 níveis antes de marcar um ad como rodando.
- Sempre a régua ao lado do número; réguas SEMPRE por lookup, nunca de memória.
- Veredito é dos 3 valores fechados — sem "talvez pausar".
- Snapshot não atualiza registry nem transforma sugestão em ação.
- Português BR.
