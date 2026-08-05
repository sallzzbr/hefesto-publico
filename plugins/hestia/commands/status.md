---
description: Mostra o status do mês em BRL — receitas, despesas, saldo, quebra por categoria e o comprometido restante das recorrências.
argument-hint: "[mês opcional AAAA-MM] ex.: 2026-06 (padrão: mês atual)"
---

Mostrar o status do mês do orçamento doméstico usando a skill `orcamento`.

Mês (opcional, padrão = mês atual): $ARGUMENTS

1. Use a skill `orcamento`, fluxo "Status do mês".
2. Leia o `AAAA-MM.csv` do mês indicado, na pasta de orçamento resolvida pela skill, pelo
   conector do Google Drive, com fallback de leitura do caminho legado.
   Se não existir em nenhum dos dois, diga que não há lançamentos e ofereça lançar ou abrir o mês.
3. Apresente em BRL: receitas, despesas, **saldo do mês** e a quebra de despesas por categoria
   (maior → menor, com % do total).
4. Se houver `recorrencias.csv`, mostre o **comprometido restante** (recorrências ainda não
   lançadas) e o saldo projetado.
5. Se houver categorias redundantes, sugira consolidação — sem alterar nada sozinho. Para análise
   histórica, aponte o `/hestia:analisar`.
