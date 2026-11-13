# Template do relatório analise-produto.md

O script gera estas seções, nesta ordem. Ao apresentar ao dono, mantenha a ordem e a separação.

1. `# Análise de produto <periodo>`: tamanho do catálogo e contagem de vendas internas retiradas da fonte de vendas (em unidades), com o aviso de que a fonte de tráfego não as separa e as taxas de compra podem incluí-las.
2. Aviso fixo: o canal "sem anúncio" do GA4 vem contaminado por pedidos internos e de conhecidos.
3. `## Leitura estatística: afirmado (p < 0,05)`: só diferenças com p < 0,05 **e** amostra
   suficiente, e que não somem dentro dos estratos dos demais eixos.
4. `## Leitura estatística: não comprovado`: p >= 0,05, "sem poder para afirmar" e totais
   confundidos pelos demais eixos. Traz o total e a leitura dentro de cada estrato lado a lado.
5. `## Produzir`, `## Investir`, `## Rever`: ações por item, só com p < 0,05 e poder contra o resto
   (critérios em `contrato.md`); sempre presentes, "Nenhum item com evidência." se vazios.
6. `## Candidatas a re-estética`: bom clique e compra fraca, só com CTR maior e compra menor que o resto, os dois
   com p < 0,05 e poder; cada uma com "mesma ideia, nova cor, fonte ou estrutura". Sempre presente,
   "Nenhum item com evidência." se vazia.
7. `## Observações (não comprovado)`: itens que passaram o corte (vitrine ou re-estética) mas sem evidência;
   sem recomendação.
8. `## Lacunas de portfólio`: células do catálogo (um valor por eixo) com até `lacunaMaxItens` itens, da menor
   contagem para a maior. Contagem do catálogo, não de venda: lacuna não prova demanda.
9. `## Sugestão de conjunto`: só sugestão. Para os itens com evidência (Produzir e Investir): `reusar: <conjunto> (<status>)`
   quando um conjunto informado a cobre, `candidatas a um conjunto novo` quando nenhum cobre; sem a lista `conjuntos`, avisa que
   não deu para checar a conta; sem evidência, "Não criar conjunto agora."; lista itens de conjunto fora do catálogo; fecha
   com o aviso de que a skill não cria nada.
10. `## Qualidade da junção de nomes`: colisões, casamentos aproximados e o que não casou, por fonte.

Regra de redação para o dono leigo: dizer "não comprovado" onde o dado não sustenta, nunca
transformar "sem poder para afirmar" em recomendação. PDF leigo é saída opcional: o agente o monta
a partir deste `.md`, sem script nesta versão.
