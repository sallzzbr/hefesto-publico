---
description: Gerencia o catálogo de produtos do mercado — listar, renomear, fundir duplicatas, ajustar tipo/marca/categoria e apelidos.
argument-hint: "[ação + detalhes] ex.: \"listar\", \"funde 'Arroz Camil' com 'Arroz Camil 5kg'\", \"muda a categoria do sabão pra Limpeza\""
---

Gerenciar o catálogo de produtos usando a skill `mercado`.

Pedido (pode vir vazio — aí liste): $ARGUMENTS

1. Use a skill `mercado`, fluxo "Gerenciar catálogo".
2. O catálogo vive em `produtos.csv`, na pasta de mercado resolvida pela skill
   (`produto;tipo;marca;categoria;unidade_base;apelidos`).
3. Toda escrita mostra o antes/depois e confirma antes. Fusão migra os apelidos e NUNCA reescreve
   os itens de meses anteriores sem oferta explícita separada.
4. Ao listar, agrupe por categoria (ou por tipo, se o usuário preferir).
