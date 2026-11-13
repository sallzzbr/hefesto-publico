# Conectores

O hermes não depende de um fornecedor: as skills falam em **categorias** e cada categoria
aponta para um adaptador em `references/adaptadores/`. O adaptador guarda o que é específico do
canal (doutrina, limites e mapeamento de campos). Nenhuma skill nomeia tool de fornecedor, e o
plugin também não versiona nome de tool: o conector instalado expõe as suas, que se descobrem
pela lista de tools do servidor. Os canais ativos do workspace vêm do perfil do negócio.

| Categoria | Para que serve | Adaptador |
|---|---|---|
| plataforma de anúncios | gasto, impressões, cliques e conversões atribuídas por anúncio, conjunto e campanha | [meta-ads](references/adaptadores/meta-ads.md) |
| ledger | pedidos e receita como o negócio os contabiliza, fonte da verdade do lucro | [ledger](references/adaptadores/ledger.md) |
| analytics | sessões, funil de site e eventos de compra | [ga4](references/adaptadores/ga4.md) |

Como usar: a skill pede a categoria; o adaptador diz a doutrina e os limites do canal e como mapear os
campos do conector instalado para o vocabulário do hermes. Sem conector da categoria, a skill pede o
export (CSV) em vez de inventar o número.

Trocar de fornecedor é escrever um adaptador novo na mesma pasta e apontar a linha da categoria
para ele; as skills não mudam.
