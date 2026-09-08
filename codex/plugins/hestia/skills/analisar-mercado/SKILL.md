---
name: analisar-mercado
description: Use quando o usuário quiser analisar preços e quantidades de supermercado, comparar produtos ou pesquisar preços online sob demanda.
---

# Analisar Mercado

Na primeira utilização, leia `../../RUNTIME.md`,
`../../shared/skills/analisar-mercado/CONTRATO.md` e `../../shared/skills/orcamento/references/defaults.md`. Este
entrypoint e o runtime prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva a subpasta `mercado/` e leia `AAAA-MM-itens.csv` e `produtos.csv`. Sem conector de
   leitura, devolva o bloqueio útil; não fabrique dados.
2. Materialize temporários e execute
   `python3 ../../shared/scripts/mercado.py --itens <arquivos...> --catalogo <arquivo>` com os
   filtros do pedido. Narre o JSON sem recalcular preços ou desvios.
3. Respeite as bases mínimas, conversões de unidade e seções omitidas do contrato. Mostre valores
   e percentuais antes da interpretação.
4. Pesquisa online ocorre só quando pedida e quando houver ferramenta disponível. Informe data,
   fonte, unidade, frete e limitações; não invente preço nem nome de ferramenta.

É análise somente leitura. Um relatório separado segue a autorização já dada ou exige preview e
aprovação. Dados nunca vão para o pacote/cache.
