---
name: analisar-produto
description: "Use para descobrir quais atributos do item vendem e por que: os eixos do perfil do negócio, com teste estatístico, controle de confusão e blocos Produzir, Investir e Rever. Somente leitura."
---

# analisar-produto

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/analisar-produto/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Reúna as três fontes pelo workspace, só leitura: vitrine e atenção (impressões e cliques por item no anúncio de catálogo), compra (itens vistos e comprados por item no analytics) e, no fechamento do mês, vendas da fonte de pedidos. Sem uma fonte, declare o que falta e siga com as demais.
2. Agregue por item **sem dados pessoais** e exclua as vendas internas (a regra `exclusao_vendas_internas` do perfil, quando houver) da fonte de vendas antes de calcular (a fonte de tráfego não as separa, então as taxas de compra do GA4 podem incluí-las); a contagem entra como número em `vendas_internas_excluidas` e a lista de quem comprou nunca vai para arquivo versionado. Os nomes dos eixos vêm de `eixos` do perfil do negócio (formato e reservados em `references/eixos.json`) e os valores, da tabela de catálogo do workspace, não do ledger. Com 3 ou mais eixos a lacuna é a célula de um par de eixos, com teto de 500 linhas.
3. Execute o script de cálculo (`../../shared/skills/analisar-produto/scripts/analisar-produto.mjs`, Node sem dependências) com `--entrada` e `--saida`, conforme o contrato. O script recusa entrada com dados pessoais ou incoerente.
4. Leia a junção de nomes (não casados, aproximados, colisões) antes de confiar nos números, e entregue só o que passou no teste: afirmado (p < 0,05, com poder) separado de não comprovado, com Produzir, Investir e Rever apenas para itens com evidência. Leia também as lacunas de portfólio (célula de eixos, ou par de eixos com 3 ou mais, com poucos itens) e as candidatas a re-estética (bom clique, compra fraca: mesma ideia, nova cor, fonte ou estrutura), que alimentam a sugestão de novos itens.
5. Sugira conjunto só como sugestão: se o workspace fornecer os conjuntos existentes (campo opcional `conjuntos` da entrada: nome, status e itens), o relatório indica `reusar` antes de listar candidatas a um conjunto novo; sem a lista, diz que não deu para checar. Nunca crie conjunto.
6. Grave o relatório `.md` e `.csv` no destino de inteligência de produtos do workspace. Nenhuma escrita em APIs. Recomendação relevante ganha trilha local no registry.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
