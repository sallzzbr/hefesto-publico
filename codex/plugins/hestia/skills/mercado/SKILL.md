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
2. Gere o preview completo de itens e mudanças no catálogo, com o identificador da nota na
   coluna `nota` (`AAAA-MM-DD-N`, regra do contrato). Arquivo do mês sem a coluna segue a
   compatibilidade do contrato: migrar só com confirmação, sem inventar identificador para linha
   antiga. Detecte possível nota repetida pelos critérios do contrato.
3. Materialize temporários e execute
   `python3 -B ../../shared/scripts/nota.py --itens <arquivo> --catalogo <arquivo> --nota <AAAA-MM-DD-N>`
   (arquivo sem a coluna: `--data <data> --mercado <nome>`; linhas antigas de arquivo migrado,
   com `nota` vazia: `--sem-nota --data <data> --mercado <nome>`, porque sem o `--sem-nota` a
   seleção pega também a compra identificada do mesmo dia e mercado). Narre divergências, total
   não coberto e seleção ambígua; não some grupos de cabeça. Lançamento nulo em linhas sem `nota`
   exige perguntar se a seleção é uma nota só antes de `--nota-unica-confirmada`.
4. Grave itens e catálogo depois do ok sobre a tabela final, e o livro depois do ok sobre o lote
   agrupado por categoria, conferindo duplicidade pela descrição (seção abaixo). Releia os
   arquivos após escrever e reconcilie resultado incerto.

## Confirmação antes de gravar

O pedido de lançar, registrar ou atualizar não autoriza a escrita. Antes de cada gravação no
Drive, mostre a linha ou o lote final exato (arquivo de destino, linhas em CSV cru e, na edição,
o antes/depois) e espere o ok do usuário, como no contrato. A única exceção é o usuário dizer
explicitamente, nesta sessão, que pode gravar sem mostrar. Esta regra prevalece sobre o
reaproveitamento de autorização do runtime.

Sem escrita, devolva os CSVs/lotes propostos. Não invente operações de Drive nem grave no cache.
