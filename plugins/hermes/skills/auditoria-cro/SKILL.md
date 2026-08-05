---
description: "Run a CRO audit of an e-commerce site (own or competitor) with a fixed 10-item checklist. Use when the user wants to know why the site doesn't convert or how it compares — auditoria CRO, auditoria de site, conversão do site, above the fold, análise de PDP, comparar com concorrente."
---

# Auditoria CRO

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Auditoria de conversão de um site de e-commerce (o próprio ou concorrente): screenshots
desktop + mobile, leitura da copy real, performance mobile, e um **checklist fixo de 10
itens** com achados priorizados P1/P2/P3. Regra de ouro: **evidência sempre** — item de
checklist sem screenshot/trecho citado não vale.

## Coleta (antes de opinar)

1. **Screenshots** desktop e mobile das páginas-chave (home, categoria/coleção, PDP,
   carrinho) — script do workspace quando existir (`scripts/screenshot_site.py`) ou
   navegação/WebFetch. Leia as imagens.
2. **Copy real** das páginas (headlines, claims, CTAs) — texto literal, não impressão.
3. **Performance mobile**: PageSpeed Insights (API keyless via curl; fallback lighthouse).
4. Réguas do negócio por lookup quando for o próprio site: unit-economics mais recente e
   taxas reais do funil (analytics) — pra priorizar por impacto em dinheiro.

## Checklist fixo (10 itens, ✅/⚠️/🛑 + evidência)

1. **Above the fold** responde em 3s: o que é, pra quem, por que agora (proposta + CTA
   visíveis sem scroll, desktop E mobile).
2. **Oferta/desconto progressivo visível** onde a decisão acontece (não escondida em banner
   rotativo ou página institucional).
3. **Âncora de frete grátis** clara e repetida no caminho do carrinho (é alavanca de AOV).
4. **Prova social**: reviews/depoimentos/números reais, perto do CTA.
5. **Fricção até o carrinho**: cliques e campos contados da home ao checkout; cada passo
   extra é vazamento.
6. **Copy na voz da marca** (não institucional genérica) e benefício antes de característica.
7. **Mobile-first de verdade**: tap targets, fonte legível, imagens não cortadas (a maioria
   do tráfego pago é mobile).
8. **Performance**: PSI mobile ≥ 50 (abaixo disso, o funil perde gente antes de ver a página).
9. **Navegação/categoria**: chega-se ao produto certo em ≤ 2 cliques a partir da home?
10. **PDP completa**: fotos que mostram o produto de verdade, tabela de medidas/variações,
    preço parcelado, CTA único dominante, objeções respondidas na página.

## Saída

Relatório em `marketing/inteligencia/site-auditorias/AAAA-MM-DD-<alvo>.md`:

- Achados **P1** (perde dinheiro agora) / **P2** (limita crescimento) / **P3** (polish),
  cada um com evidência + correção concreta + esforço estimado.
- **CONFIGURÁVEL × TRAVADO na plataforma**: em SaaS fechado, separe o que dá pra corrigir na
  configuração do que exige workaround/mudança de plano — recomendação de item travado é
  ruído.
- Concorrente: mesma régua, terminando em hipóteses de teste pro próprio site (nunca cópia
  literal de copy/arte).

## Regras

- Priorização por **impacto × esforço**, com o impacto em dinheiro quando as réguas existem.
- Screenshots/prints ficam fora do git quando o workspace assim trata (dados, não código).
- Português BR.
