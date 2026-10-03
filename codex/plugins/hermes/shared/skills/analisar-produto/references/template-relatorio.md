# Template do relatório analise-produto.md

O script gera estas seções, nesta ordem. Ao apresentar ao dono, mantenha a ordem e a separação.

1. `# Análise de produto <periodo>`: tamanho do catálogo e contagem de compras da casa retiradas das vendas do ERP (em unidades), com o aviso de que o GA4 não separa família e as taxas de compra podem incluí-la.
2. Aviso fixo: o canal "sem anúncio" do GA4 vem contaminado pela família.
3. `## Leitura estatística: afirmado (p < 0,05)`: só diferenças com p < 0,05 **e** amostra
   suficiente, e que não somem dentro do estilo.
4. `## Leitura estatística: não comprovado`: p >= 0,05, "sem poder para afirmar" e totais
   confundidos por estilo. Traz o total e a leitura dentro de cada estilo lado a lado.
5. `## Produzir`, `## Investir`, `## Rever`: ações por estampa, só com p < 0,05 e poder contra o resto
   (critérios em `contrato.md`); sempre presentes, "Nenhuma estampa com evidência." se vazios.
6. `## Observações (não comprovado)`: estampas que passaram o corte mas sem evidência; sem recomendação.
7. `## Sugestão de conjunto`: só sugestão. Para as estampas com evidência (Produzir e Investir): `reusar: <conjunto> (<status>)`
   quando um conjunto informado a cobre, `candidatas a um conjunto novo` quando nenhum cobre; sem a lista `conjuntos`, avisa que
   não deu para checar a conta; sem evidência, "Não criar conjunto agora."; lista estampas de conjunto fora do catálogo; fecha
   com o aviso de que a skill não cria nada.
8. `## Qualidade da junção de nomes`: colisões, casamentos aproximados e o que não casou, por fonte.

Regra de redação para o dono leigo: dizer "não comprovado" onde o dado não sustenta, nunca
transformar "sem poder para afirmar" em recomendação. PDF leigo é saída opcional: o agente o monta
a partir deste `.md`, sem script nesta versão.
