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
   `python3 -B ../../shared/scripts/mercado.py --itens <arquivo> --catalogo <arquivo>` com os
   filtros do pedido; `--itens` aceita um único CSV — para a janela de vários meses, concatene os
   `AAAA-MM-itens.csv` (um cabeçalho) num temporário do workspace. Narre o JSON sem recalcular preços ou desvios.
3. Respeite as bases mínimas, conversões de unidade e seções omitidas do contrato. Mostre valores
   e percentuais antes da interpretação.
4. Pesquisa online ocorre só quando pedida e quando houver ferramenta disponível. Informe data,
   fonte, unidade, frete e limitações; não invente preço nem nome de ferramenta.

## Confirmação antes de gravar

Esta skill é leitura. O pedido de análise não autoriza a escrita de relatório: antes de salvar
um relatório em arquivo separado, mostre o caminho e o conteúdo e espere o ok do usuário. A
única exceção é o usuário dizer explicitamente, nesta sessão, que pode gravar sem mostrar. Esta
regra prevalece sobre o reaproveitamento de autorização do runtime.

Dados nunca vão para o pacote/cache.
