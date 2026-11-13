---
name: auditoria-cro
description: "Run a CRO audit of an e-commerce site, own store or competitor, with fixed checklists, mobile at 390 px first and finding state across rounds. Use when the user wants to know why the site doesn't convert or how it compares — auditoria CRO, auditoria de site, conversão do site, above the fold, análise de PDP, comparar com concorrente, checklist operacional de loja."
allowed-tools: Read, Grep, Glob, WebFetch
---

# Auditoria CRO

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Auditoria de conversão de um site de e-commerce em dois modos, com screenshots, leitura da copy
real, performance mobile e **checklists fixos** com achados priorizados P1/P2/P3. Regra de ouro:
**evidência sempre** — item de checklist sem screenshot/trecho citado não vale.

## Modo

- `proprio` (default quando o alvo é a loja do workspace): usa as entradas do workspace abaixo,
  compara com a rodada anterior e prioriza por impacto em dinheiro.
- `concorrente`: mesma régua de leitura, sem entradas do workspace; termina em hipóteses de teste
  para a própria loja (nunca cópia literal de copy/arte).

## Entradas do workspace (modo `proprio`)

- **Capacidades do painel**: o que a plataforma da loja deixa configurar e o que é travado
  (arquivo do workspace, ex.: `marketing/loja/capacidades-do-painel.md`, path ilustrativo).
- **Decisões vigentes**: escolhas já tomadas pelo dono, com data (oferta em vigor, "uma contagem
  regressiva só", tema escolhido), ex.: `marketing/loja/decisoes-vigentes.md`.
- **Auditoria anterior do mesmo alvo**, em `marketing/inteligencia/site-auditorias/`, para o
  estado de cada achado.

Sem capacidades do painel ou decisões vigentes, diga que faltam e trate todo achado como aberto.
Achado que bate com uma das decisões vigentes ou com algo travado pela plataforma vira
**nota de 1 linha** (o achado e a decisão ou trava que o explica), não tarefa: recomendar item já
decidido ou travado é ruído.

## Coleta (antes de opinar), celular a 390 px primeiro

1. **Screenshots no celular a 390 px de largura primeiro**, depois desktop, das páginas-chave
   (home, categoria/coleção, PDP, carrinho) — script do workspace quando existir
   (`scripts/screenshot_site.py`) ou navegação/WebFetch. Leia as imagens.
2. **Copy real** das páginas (headlines, claims, CTAs, frases de oferta) — texto literal, não
   impressão.
3. **Performance mobile**: PageSpeed Insights (API keyless via curl; fallback lighthouse).
4. Réguas do negócio por lookup no modo `proprio`: unit-economics mais recente e taxas reais do
   funil (analytics) — pra priorizar por impacto em dinheiro.

## Checklist fixo de conversão (10 itens, ✅/⚠️/🛑 + evidência)

1. **Above the fold** responde em 3s: o que é, pra quem, por que agora (proposta + CTA
   visíveis sem scroll, no celular e no desktop).
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

## Checklist operacional de loja (genérico)

Para a loja própria, com oferta, desconto e frete a controlar. Cobre rótulos, vitrine curada, cupom
exibido no produto e no carrinho, preço Pix exibido, tema mobile, página Sobre, redes, WhatsApp,
loja sazonal, coerência de preço, o teste dos 3 segundos da oferta, a mesma frase de oferta em
todos os pontos da loja, uma contagem regressiva só, margem por pedido, descontos sem empilhar,
frete e prazo de entrega. Cada item com evidência:

1. Produto com rótulos claros (modelo, cor, tamanho) na vitrine e na PDP.
2. Vitrine curada: a primeira dobra mostra o que vende, não o catálogo inteiro sem ordem.
3. Cupom exibido no produto e no carrinho, não só em banner ou pop-up.
4. Preço Pix exibido (valor à vista com desconto) na vitrine e na PDP.
5. Tema mobile próprio, sem quebra a 390 px.
6. Página Sobre dizendo quem está por trás da marca.
7. Redes linkadas e ativas.
8. WhatsApp de atendimento visível.
9. Loja sazonal: vitrine e banners acompanham a data comercial vigente.
10. Coerência de preço: o mesmo produto com o mesmo preço em vitrine, PDP, carrinho e anúncio.
11. Teste dos 3 segundos da oferta: a oferta cabe numa frase, sem conta (o cliente não precisa
    calcular), uma oferta só, e tem data para acabar.
12. A mesma frase de oferta em todos os pontos da loja (banner, PDP, carrinho, anúncio).
13. Uma contagem regressiva só: várias contagens com prazos diferentes desmontam a urgência.
14. **Margem por pedido** com a oferta em vigor (modo `proprio`): margem de contribuição do pedido
    com os descontos ativos (pelo unit-economics citado), menos o CAC real do período (CPA de
    ledger do `pnl-mensal`, ou de plataforma com o fator ledger ÷ plataforma), sobre o ticket. Heurística de mercado:
    abaixo de 10% é risco, 15% é saudável, 20% é muito bom (o workspace pode registrar
    outra faixa). Sem unit-economics, o item fica "não verificado".
15. Descontos sem empilhar: progressivo, Pix e cupom não somam no mesmo pedido (empilhados, comem
    a margem por pedido). Teste no carrinho com os três juntos.
16. Ordem das opções de frete no checkout conforme a data: o frete mais barato primeiro na Black
    Friday, o mais rápido primeiro no Natal.
17. Prazo de entrega por região testado no carrinho (CEPs de regiões diferentes) antes de
    prometer data em anúncio, banner ou PDP.

### Site próprio

Em site próprio (domínio e tema da própria loja; na vitrine da plataforma, confira nas
capacidades do painel, e item travado vira nota de 1 linha):

18. Favicon da marca.
19. Página Sobre (item 6) dizendo quem está por trás da marca.
20. Ícones de confiança (pagamento seguro, troca, entrega) perto do CTA e no checkout.

## Estado do achado entre rodadas

No modo `proprio`, compare com a auditoria anterior do mesmo alvo. Cada achado sai como **novo**,
**aberto há N rodadas** (N contando esta) ou **resolvido** (estava na rodada anterior e não
aparece mais, com evidência de que saiu). Achado aberto há várias rodadas sem efeito é sinal de
trava ou de decisão não registrada: pergunte ao dono antes de repetir a recomendação.

## Saída

Relatório em `marketing/inteligencia/site-auditorias/AAAA-MM-DD-<alvo>.md`:

- Modo e entradas usadas (ou ausentes), com a data da auditoria anterior comparada.
- Achados **P1** (perde dinheiro agora) / **P2** (limita crescimento) / **P3** (polish), cada
  um com evidência + correção concreta + esforço estimado + estado (novo, aberto há N rodadas,
  resolvido).
- Notas de 1 linha para o que já está decidido ou travado.
- **CONFIGURÁVEL × TRAVADO na plataforma**: em SaaS fechado, separe o que dá pra corrigir na
  configuração do que exige workaround/mudança de plano — recomendação de item travado é
  ruído.
- Concorrente: mesma régua, terminando em hipóteses de teste pro próprio site.

## Regras

- Priorização por **impacto × esforço**, com o impacto em dinheiro quando as réguas existem.
- Screenshots/prints ficam fora do git quando o workspace assim trata (dados, não código).
- Somente leitura: a skill não altera a loja.
- Português BR.
