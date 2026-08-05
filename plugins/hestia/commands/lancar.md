---
description: Lança uma despesa ou receita do mês no CSV do Google Drive (confirma antes de gravar e evita categorias duplicadas).
argument-hint: "[valor categoria descrição método] ex.: 352,90 mercado \"compra do mês\" crédito — ou \"receita 5000 salário\""
---

Lançar uma despesa ou receita do orçamento doméstico usando a skill `orcamento`.

Lançamento (pode vir vazio): $ARGUMENTS

1. Use a skill `orcamento`, fluxo "Lançar (despesa ou receita)".
2. Interprete $ARGUMENTS em linguagem natural: tipo (despesa ou receita — "recebi"/"lança receita"
   → receita; na dúvida, despesa), data padrão = hoje, valor, categoria, descrição, método.
   Pergunte só o que faltar.
3. Antes de gravar, cheque a categoria contra as já usadas do mesmo tipo no mês e sugira
   reaproveitar um rótulo existente se for parecido — não fragmente categorias.
4. Mostre a linha exata que será gravada (com o campo `tipo`) no `AAAA-MM.csv` da pasta de
   orçamento resolvida pela skill e só grave após a confirmação. Se o CSV do mês não existir,
   aplique o fallback do caminho legado descrito na skill antes de criar um arquivo novo.
