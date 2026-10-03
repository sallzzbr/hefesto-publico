---
name: analisar-produto
description: "Use para descobrir qual estampa vende e por que: estilo ou raça, com teste estatístico, controle de confusão e blocos Produzir, Investir e Rever. Somente leitura."
---

# analisar-produto

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/analisar-produto/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Reúna as três fontes pelo workspace, só leitura: vitrine e atenção (impressões e cliques por estampa no anúncio de catálogo), compra (itens vistos e comprados por estampa no analytics) e, no fechamento do mês, vendas do ERP. Sem uma fonte, declare o que falta e siga com as demais.
2. Agregue por estampa **sem dados pessoais** e exclua as compras da família das vendas do ERP antes de calcular (o GA4 não separa família, então as taxas de compra do GA4 podem incluir compras da casa); a lista da família nunca vai para arquivo versionado. Raça e estilo vêm da tabela de catálogo do workspace, não do ledger.
3. Execute o script de cálculo (`../../shared/skills/analisar-produto/scripts/analisar-produto.mjs`, Node sem dependências) com `--entrada` e `--saida`, conforme o contrato. O script recusa entrada com dados pessoais ou incoerente.
4. Leia a junção de nomes (não casados, aproximados, colisões) antes de confiar nos números, e entregue só o que passou no teste: afirmado (p < 0,05, com poder) separado de não comprovado, com Produzir, Investir e Rever apenas para estampas com evidência.
5. Sugira conjunto só como sugestão: se o workspace fornecer os conjuntos existentes (campo opcional `conjuntos` da entrada: nome, status e estampas), o relatório indica `reusar` antes de listar candidatas a um conjunto novo; sem a lista, diz que não deu para checar. Nunca crie conjunto.
6. Grave o relatório `.md` e `.csv` no destino de inteligência de produtos do workspace. Nenhuma escrita em APIs. Recomendação relevante ganha trilha local no registry.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
