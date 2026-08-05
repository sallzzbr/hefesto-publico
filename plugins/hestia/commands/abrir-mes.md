---
description: Abre o mês do orçamento doméstico — lança as recorrências cadastradas (contas fixas, assinaturas, parcelas, salário) em lote, com uma confirmação só e sem duplicar.
argument-hint: "[mês opcional AAAA-MM] ex.: 2026-08 (padrão: mês atual)"
---

Abrir o mês do orçamento doméstico usando a skill `orcamento`.

Mês (opcional, padrão = mês atual): $ARGUMENTS

1. Use a skill `orcamento`, fluxo "Abrir o mês (recorrências em lote)".
2. Leia `recorrencias.csv` na pasta de orçamento resolvida pela skill; se não existir, explique e ofereça cadastrar
   recorrências primeiro (`/hestia:recorrencias`).
3. Cheque o que já foi lançado no mês (nome+valor) — abrir duas vezes não duplica nada; liste o
   que já estava lá.
4. Mostre a lista prevista (nome, tipo, categoria, valor, dia, parcelas restantes) e lance o lote
   com **uma única confirmação**. Respeite pedidos de pular itens.
5. Depois do lote, decremente `parcelas_restantes` das parceladas lançadas (escrita confirmada;
   parcela que chegar a 0 sai do cadastro, também com confirmação).
6. Feche com o mini-status: previsto lançado e saldo projetado do mês.
