---
name: mercado
description: Use quando o usuário quiser registrar nota de supermercado, catalogar produtos, lançar a compra agrupada no orçamento ou gerenciar o catálogo.
---

# Mercado

Na primeira utilização, leia `../../RUNTIME.md`, `../../shared/skills/mercado/CONTRATO.md` e a
referência de defaults do Hestia. Este entrypoint e o runtime prevalecem para paths, ferramentas
e autorização.

## Fluxo nativo

1. Resolva `mercado/`, leia o catálogo e extraia da nota apenas campos observáveis. Mostre itens
   incertos, divergências e produtos sem casamento; nunca adivinhe silenciosamente.
2. Gere o preview completo de itens e mudanças no catálogo. Detecte possível nota repetida pelos
   critérios do contrato.
3. Materialize temporários e execute
   `python3 ../../shared/scripts/nota.py --itens <arquivo> --catalogo <arquivo> --data <data> --mercado <nome>`.
   Narre divergências, total não coberto e seleção ambígua; não some grupos de cabeça.
4. Para lançar no orçamento, mostre o lote agrupado por categoria e confira duplicidade. Execute
   itens, catálogo e livro somente dentro da autorização existente; peça aprovação apenas para
   mutações novas. Releia os arquivos após escrever e reconcilie resultado incerto.

Sem escrita, devolva os CSVs/lotes propostos. Não invente operações de Drive nem grave no cache.
