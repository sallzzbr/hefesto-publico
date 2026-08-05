---
description: Registra uma nota de supermercado (foto do cupom, PDF/print do app ou ditado) — extrai itens, casa com o catálogo e oferece lançar no orçamento agrupado por categoria.
argument-hint: "[anexe a foto/PDF da nota ou dite] ex.: \"atacadão hoje: 2kg arroz Camil 18,90, 6 leites Itambé 4,89…\""
---

Registrar uma nota de mercado usando a skill `mercado`.

Nota (anexo ou ditado; pode vir vazio — aí peça): $ARGUMENTS

1. Use a skill `mercado`, fluxo "Registrar nota".
2. Extraia mercado, data e itens (quantidade, unidade, unitário, total) sem inventar nada —
   campo ilegível se pergunta. Confira a soma contra o total da nota.
3. Case cada item com o catálogo (`produtos.csv`) por apelido e semelhança; item novo vira
   proposta de entrada; nome cru novo vira apelido.
4. Mostre a tabela final (itens + mudanças de catálogo) e grave tudo com UMA confirmação em
   `AAAA-MM-itens.csv` + `produtos.csv`, na pasta de mercado resolvida pela skill.
5. Siga para o fluxo "Lançar no livro": ofereça o lançamento no orçamento agrupado por categoria
   (uma linha por categoria, uma confirmação), sem duplicar nota já lançada.
