---
description: "Assess the paid funnel health (topo/meio/fundo) of a Meta Ads account — coleta funil por nível, calcula conversões de etapa, monta a tabela SAÚDE DO FUNIL com benchmarks por lookup e aponta o gargalo. Use when o usuário pedir 'saúde do funil', 'como está o funil', 'funnel health', ou como Fase 1 de um briefing semanal. Somente leitura."
---

# Saúde do Funil

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.

Diagnóstico do funil pago em três etapas (topo/meio/fundo), com benchmark ao lado de cada
número e o gargalo nomeado. É a fase de funil de um briefing semanal — funciona também
avulsa. **Somente leitura.**

## Antes de rodar (lookup obrigatório — cola do workspace)

1. **Economia unitária:** `financeiro/relatorios/unit-economics-*.md` mais recente (CAC
   alvo, CAC máximo, ROAS alvo, breakeven) e CITAR o arquivo usado. Sem relatório, **pare a
   parte de economia** e aponte `hermes:unit-economics` — régua decorada não emite
   diagnóstico.
2. **Benchmarks de funil vigentes:** os do workspace (doutrina/estratégia), quando
   documentados; sem doutrina local, use referências de mercado declarando que são genéricas
   (CPM, CTR ≥ 1.5%, freq ≤ 3.0, CPC, ATC rate ≥ 3%) — nunca as apresente como régua da conta.
3. **Registry:** `marketing/registry/{campanhas,conjuntos,anuncios}/_indice.csv` — hipóteses,
   CAC alvo por anúncio, critérios de sucesso/pausa.

**Período:** o pedido pelo usuário; default `last_7d`.

## Passos

1. **Coletar funil:** `ads_get_ad_entities` `level=account` com o período (campos:
   `amount_spent, impressions, reach, frequency, ctr, cpc, cpm, results,
   actions:omni_purchase, actions:add_to_cart, actions:initiate_checkout, purchase_roas,
   cost_per_result`), depois `level=campaign` ordenado por gasto. **Boost fora da régua:**
   tráfego que NÃO otimiza por conversão (boost/impulsionamento e afins) fica FORA de
   CPA/ROAS/CTR médios e de qualquer diagnóstico — identifique pelo `optimization_goal` (e
   pelo objetivo da campanha), NUNCA pelo nome; o gasto total real entra no relatório numa
   linha própria, rotulada. Gasto sem compra no denominador contamina a régua e derruba
   decisão boa.
2. **Conversões de etapa:** topo (impressões, alcance, freq, CPM, CTR) · meio (clicks, CPC,
   ATC rate, CPATC) · fundo (ATC → checkout, checkout → compra, CPA real, ROAS).
3. **Tabela SAÚDE DO FUNIL:** uma linha por métrica com `valor real | benchmark (fonte) |
   diagnóstico ✅/⚠️/🛑`. Benchmark de CPA/ROAS vem SEMPRE do unit-economics citado.
4. **Cruzar com registry:** para cada id retornado, buscar o slug local e carregar hipótese +
   critérios; mostrar **ao lado** dos números. Campanha sem entrada local → sinalizar
   pendência de registro (não chutar).
5. **Gargalo:** apontar a etapa que mais comprime conversão, com o número que o prova.

## Saída

Bloco de relatório pronto para compor o briefing semanal do workspace (ou resposta avulsa):
tabela + cruzamento + gargalo. Quem grava o arquivo consolidado é o fluxo chamador.

## Regras

- Somente leitura no Meta. Mínimo de gasto por entidade para diagnóstico (padrão R$50; use o
  do workspace se documentado) — abaixo, "dados insuficientes".
- Benchmark sempre com fonte citada; número sem contexto é número solto.
- Português BR.
