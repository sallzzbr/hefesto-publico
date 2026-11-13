# Adaptador: ledger

Categoria `ledger` do `CONNECTORS.md`. O ledger é a fonte da verdade de pedido, receita e custo;
vive no workspace do usuário (planilha, CSV ou sistema de pedidos exportado), não num fornecedor
fixo.

## Doutrina

- Receita e lucro de ledger prevalecem sobre atribuição de plataforma; a diferença vira o fator
  ledger ÷ plataforma do `pnl-mensal`.
- Vendas internas (teste, amigos, reposição) saem pela regra de exclusão declarada no perfil do
  negócio; nenhuma skill assume a regra.
- O path do ledger resolve pela regra única de path do plugin (campo `local_*` do workspace),
  nunca por path escrito na skill.

## Limites

- Só vale o que está no export: pedido cancelado, devolvido ou fora do período muda o total; o
  relatório cita o arquivo e o período lidos.
- Moeda única por export; moeda diferente da do perfil é recusada, não convertida.

## Campos

| Hermes | Coluna esperada |
|---|---|
| data do pedido | `data` |
| pedido | `pedido` |
| item | `item` |
| receita | `receita` |
| custo | `custo` |
| status | `status` |
| origem da venda | `origem` (base da regra de exclusão de vendas internas) |

Nomes de coluna são o contrato mínimo; o export real é mapeado para eles antes da análise.
