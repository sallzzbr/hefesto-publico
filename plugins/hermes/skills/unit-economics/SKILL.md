---
description: "Compute e-commerce unit economics and ad-budget scenarios. Use when the user wants margins, breakeven CAC, target ROAS or to simulate an ad budget — unit economics, margem por pedido, CAC máximo, ROAS alvo, cenário de verba, quanto posso pagar por venda."
---

# Unit Economics (+ cenário de verba)

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Calcula a economia unitária de um e-commerce e deriva as réguas que governam TODAS as
decisões de ads: **CAC breakeven, CAC alvo e ROAS alvo**. Opcionalmente simula cenários de
verba ("essa verba mensal fecha a conta?"). É a **fonte canônica das réguas** — as outras
skills do hermes leem o relatório mais recente desta, nunca números de memória.

## Modo 1 — unit economics

Insumos (do workspace: catálogo com custos, premissas financeiras, ledger/histórico; o que
faltar, pergunte — e trate campo `PREENCHER` com estimativa conservadora, sinalizada):

1. **Margem por produto**: preço − custo do fornecedor − taxas de plataforma/pagamento −
   frete absorvido − desconto médio praticado. Em R$ e %.
2. **Margem de contribuição por pedido**: margem ponderada × itens médios por pedido (use o
   ticket médio e o mix REAIS do ledger; sem ledger, declare a premissa).
3. **CAC breakeven** = margem de contribuição por pedido (acima disso, prejuízo por venda).
4. **CAC alvo** = margem − lucro desejado por pedido (tabela pra 10/20/30% de margem líquida).
5. **ROAS breakeven** = ticket médio ÷ margem por pedido (= 1 ÷ margem%); **ROAS alvo** idem
   sobre o CAC alvo.

Destaque o número-chave (CAC máximo) e grave em
`financeiro/relatorios/unit-economics-AAAA-MM.md` — as demais skills fazem lookup daqui.

## Modo 2 — cenário de verba

Dada uma verba mensal candidata: vendas necessárias por nível de CAC (`vendas = verba ÷
CAC`), resultado projetado (margem de contribuição total − verba), CAC/ROAS de breakeven
**pra essa verba**, reality check contra o volume atual do negócio (a verba exige N× as
vendas de hoje? diga), e recomendação de rampa (subir em degraus com critério de validação
por degrau, não tudo de uma vez). Grave em `financeiro/relatorios/cenario-ads-AAAA-MM.md`.

## Regras

- Toda premissa declarada no relatório (mix, ticket, taxas) — número sem fonte não entra.
- Estimativa conservadora quando faltar dado, sempre sinalizada como estimativa.
- Recalcule quando custo/preço/mix mudar — relatório velho envenena todas as réguas a
  jusante (as outras skills citam o arquivo + mês que usaram).
- Português BR; valores em BRL.
