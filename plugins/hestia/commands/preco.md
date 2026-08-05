---
description: Pesquisa o preço de um produto online (Amazon, Mercado Livre, mercados da região) e compara com o que você pagou nas tuas notas.
argument-hint: "[produto] ex.: \"arroz Camil 5kg\", \"café\""
---

Pesquisar preço online usando a skill `analisar-mercado`.

Produto: $ARGUMENTS

1. Use a skill `analisar-mercado`, fluxo "Pesquisa de preço online".
2. Se ainda não souber a cidade/região do usuário nesta conversa, pergunte antes de buscar
   mercados da região.
3. Busque na web (Amazon, Mercado Livre, mercados/atacados da região) e compare lado a lado com o
   que o usuário pagou (histórico na pasta de mercado resolvida pela skill).
4. Guardrails: cite fonte e data da consulta; avise sobre frete/promoções; sem resultado
   confiável, diga que não achou — nunca estime.
