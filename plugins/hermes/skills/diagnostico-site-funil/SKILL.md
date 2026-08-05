---
description: "Diagnose whether paid traffic problems live in the SITE or in the AD — cruza analytics de comportamento (GA4) × custo (Meta) × registry (destino de cada ad) × ledger, com veredito por destino: SITE, ANÚNCIO, DESTINO ou INCONCLUSIVO, e seção fixa de alavancas de AOV. Use when o usuário perguntar 'o problema é o site ou o anúncio?', 'diagnóstico do funil do site', 'CRO vs criativo'. Somente leitura."
---

# Diagnóstico Site × Funil

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.

Responde **com dados** a pergunta que separa duas decisões muito diferentes: gastar energia
em **criativo/segmentação** (anúncio) ou em **página/oferta** (site). Cruza 4 fontes:

| Fonte | O que entrega | De onde vem |
|---|---|---|
| Analytics (GA4) | Comportamento no site (sessões, views, ATC, checkouts, compras) | coletor do WORKSPACE (ex.: `scripts/ga4_pull.py` + property no `.env`/CLAUDE.md local) |
| Meta MCP | Custo e cliques por ad ativo | `ads_get_ad_entities` + insights |
| Registry | Para onde cada ad aponta (`tipo_destino`: `produto`\|`colecao`\|`home`) | `marketing/registry/anuncios/*.md` |
| Ledger | Receita real e itens/pedido | `financeiro/` do workspace + unit-economics mais recente |

**Somente leitura + sugestões.** Nenhum write em GA4, Meta ou qualquer API. Sem o coletor de
analytics do workspace, PARE a parte GA4 e diga o que falta — não estime comportamento.

## Aviso metodológico (não pular)

**GA4 e Meta NUNCA batem 1:1** (atribuição, janelas, cookies). Não tente reconciliar:
GA4 = **comportamento** (depois do clique); Meta = **custo** (levar a pessoa até lá). Nunca
compare "compras GA4" com "compras Meta" como se fossem o mesmo número.

## Passos

1. **Puxar o comportamento** com o coletor do workspace (canais, landing pages, funil,
   produtos) no período pedido (default 28 dias — janelas GA4 e Meta iguais).
2. **Mapear ads ativos → destino:** cascata campanha → conjunto → ad com `effective_status`
   (ACTIVE em campanha não garante entrega); insights por ad (`amount_spent`, `ctr`,
   `impressions`, `actions:omni_purchase`); cruzar `ad_id` com o registry e ler
   `tipo_destino` + URL. Ad ativo sem `tipo_destino` → "pendência de backfill", seguir sem
   chutar.
3. **Cruzar funil × custo por destino:** tabela central por landing —
   `destino | tipo_destino | gasto | CTR | sessões | views | ATC | checkouts | compras GA4 |
   ATC/sessão | compra/ATC`. Benchmarks de leitura: os do próprio histórico do workspace
   (relatórios anteriores em `marketing/inteligencia/site-funil/`); sem histórico, use as
   médias do período como base e diga isso.
4. **Alavancas de AOV (seção fixa, sempre presente):** itens/pedido atual (ledger), combos e
   frete grátis visíveis no caminho do tráfego pago? Impacto calculado com os números do
   unit-economics **citado** — nunca decorados.
5. **Veredito por destino** (gasto relevante; padrão ≥ R$50, use o do workspace se
   documentado):
   - **SITE** — anúncio entrega (CTR/sessões/ATC ok) mas compra fraca → página/checkout/oferta.
   - **ANÚNCIO** — sessão baixa pro gasto e/ou CTR fraco → antes do site
     (`hermes:evoluir-vencedor`, `hermes:sugerir-criativos`, público).
   - **DESTINO** — funil quebra na transição anúncio→página (arte específica apontando pra
     página genérica; views/ATC baixos numa landing genérica) → trocar a URL de destino.
   - **INCONCLUSIVO** — sem dado suficiente; não force veredito.
   Sempre o número ao lado do veredito.
6. **Gravar + fechar o loop:** relatório append-only em
   `marketing/inteligencia/site-funil/AAAA-MM-DD.md` (funil do período, tabela cruzada,
   AOV, vereditos, pendências, recomendações); recomendação relevante vira linha na trilha
   do registry do ad — sem linha no registry, não aconteceu.

## Regras

- Somente leitura em todas as fontes; a skill recomenda, o humano executa.
- GA4 para comportamento, Meta para custo — nunca misturar atribuições.
- Sempre conferir os 3 níveis Meta antes de marcar um ad como entregando.
- Seção de AOV é obrigatória em toda execução, mesmo que a resposta seja "nada a fazer".
- Português BR.
