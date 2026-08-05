---
description: Gerencia o cadastro de recorrências do orçamento — listar, adicionar, editar ou remover contas fixas, assinaturas, parcelamentos e receitas recorrentes.
argument-hint: "[ação + detalhes] ex.: \"adiciona aluguel 2800 todo dia 5\", \"a Netflix subiu pra 55,90\", \"listar\""
---

Gerenciar as recorrências do orçamento doméstico usando a skill `orcamento`.

Pedido (pode vir vazio — aí liste): $ARGUMENTS

1. Use a skill `orcamento`, fluxo "Gerenciar recorrências".
2. O cadastro vive em `recorrencias.csv`, na pasta de orçamento resolvida pela skill
   (`nome;tipo;categoria;descricao;valor;dia;metodo;parcelas_restantes` — `parcelas_restantes`
   vazio = fixa, número = parcelamento). Se não existir, crie com o cabeçalho na primeira adição,
   avisando.
3. Para escrever (adicionar/editar/remover): mostre a linha final exata (ou antes/depois) e
   **confirme antes**.
4. Ao listar, agrupe fixas e parceladas, em BRL, com o total mensal comprometido de despesas e o
   total recorrente de receitas.
