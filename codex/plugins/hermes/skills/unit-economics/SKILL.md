---
name: unit-economics
description: "Use para calcular margem por pedido, CAC máximo/alvo, ROAS ou simular cenário de verba de e-commerce."
---

# unit-economics

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/unit-economics/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Leia catálogo/custos, taxas, frete, descontos e ledger/mix/ticket reais. Falta ou PREENCHER exige pergunta ou estimativa conservadora claramente sinalizada; toda premissa tem origem.
2. Calcule preço − fornecedor − taxas − frete − desconto por produto (R$ e %); pondere mix e itens/pedido para margem de contribuição por pedido. CAC breakeven=margem; CAC alvo=margem−lucro desejado, cenários de 10/20/30% de margem líquida.
3. ROAS breakeven=ticket/margem e ROAS alvo=ticket/CAC alvo; denominador não positivo deve ser explicado, sem fabricar número. Destaque CAC máximo e grave relatorios/unit-economics-AAAA-MM.md no financeiro resolvido, fonte canônica das réguas.
4. Se pedida verba: vendas=verba/CAC por cenário; resultado=margem total−verba; compare volume necessário ao atual e recomende rampa com critério por degrau. Grave cenario-ads-AAAA-MM.md.
5. Recalcule quando preço/custo/mix mudar. BRL, premissas e limitações explícitas, sem executar gastos.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
