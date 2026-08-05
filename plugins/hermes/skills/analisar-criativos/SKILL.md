---
description: "Dissect running ads by hook, copy framework, visual format and tone versus performance. Use when the user wants creative analysis of an ad account — analisar criativos, dissecar anúncios, padrões dos vencedores, ângulos não testados, matriz hook × framework."
---

# Analisar Criativos

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Disseca os anúncios rodando de uma conta de ads (leitura pura via MCP da plataforma),
classifica cada um por **hook × copy framework × formato visual × tom**, cruza com
performance e entrega: padrões dos vencedores, padrões dos perdedores e **ângulos ainda sem
teste**. É o alimento do ângulo exploratório de `hermes:sugerir-criativos`.

## Taxonomias (fechadas — não invente categoria)

- **Hook** (abertura do body/title, texto literal): Pergunta · Dor · Resultado · Prova
  social · Curiosidade · Oferta direta · Desconhecido.
- **Copy framework** (estrutura do corpo): AIDA · PAS · BAB · Direto · Desconhecido.
- **Formato visual** (de metadata/nome — **nunca** inferir conteúdo visual ausente; sem
  base, marque "Inferência limitada"): imagem estática · vídeo · carrossel · story/reels;
  tema visual quando o nome revela (produto isolado, lifestyle, UGC-style, texto sobre
  imagem, antes-e-depois, infográfico).
- **Tom** (1 tag dominante): Emocional · Racional · Urgência · Aspiracional · Misto.
- Se o workspace tem arquétipos canônicos próprios, adicione a coluna cruzando com o
  registry local (lookup por id do anúncio; ad sem entrada local → sinalize pra registrar).

## Protocolo

1. **Período**: default últimos 30 dias; aceite janelas/escopo (campanha/conjunto).
2. **Coleta** (2 chamadas, join por `ad_id`): estrutura+copy (`creative` subfield) e
   insights de performance. **Filtro de inclusão**: gasto mínimo no período (default R$50) —
   abaixo vai pro apêndice "dados insuficientes". Copy vazia via API → "copy não disponível",
   siga com formato+performance. **Boost fora da régua:** anúncio que NÃO otimiza por
   conversão (boost/impulsionamento e afins) fica FORA dos tiers e das médias de CPA/ROAS/CTR
   — identifique pelo `optimization_goal` (e pelo objetivo da campanha), NUNCA pelo nome; o
   gasto total real aparece à parte, rotulado. Gasto sem compra no denominador contamina a
   régua e derruba decisão boa.
3. **Métricas por anúncio**: CTR, CPA (gasto/compras; `s/compra` se zero), ROAS, frequência.
4. **Tiers**: vencedores = top 25% por ROAS (fallback CTR); perdedores = bottom 25% por CPA
   (fallback CTR invertido); medianos = resto. Padrão dominante (moda) por tier em cada
   dimensão.
5. **Diagnóstico dos perdedores** — distinga **fraqueza criativa** (concept ruim: CTR baixo
   desde o dia 1) de **exaustão** (CTR caiu com frequência > 3,5 e impressões altas): fixes
   diferentes; classifique cada um.
6. **Ângulos não testados**: cruze `hook × framework × arquétipo` e liste as combinações com
   0 anúncios (≥ gasto mínimo). Só lacunas concretas — sem exotismo.
7. **Saída**: relatório em `marketing/inteligencia/analises-criativas/AAAA-MM-DD.md` (tabela
   completa, padrões por tier, lacunas, conclusão ancorada em 1 número concreto, apêndices);
   append **narrativo** (2-4 linhas por segmento, com fonte e data) na narrativa de
   vencedoras do workspace — nunca colar tabela bruta.

## Regras

- **Somente leitura** — nenhuma chamada de escrita na plataforma, nenhuma alteração de
  índice do registry.
- Nunca fabricar descrição visual nem número — célula sem dado diz isso.
- Erro de permissão no subfield `creative` → degradar pra nome+insights e sinalizar no topo.
- Português BR.
