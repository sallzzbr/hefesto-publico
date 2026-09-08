---
name: pnl-mensal
description: "Use para fechar DRE simplificada, resultado operacional, CAC e ROAS reais de um mês de e-commerce."
---

# pnl-mensal

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/pnl-mensal/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Fixe mês e consulte ledger, custos de fornecedor, taxas, frete e gasto real de ads; fonte inacessível pede valor com origem declarada. Mês incompleto é parcial até dia D.
2. Monte sem omissões: receita bruta de pedidos pagos − descontos = receita líquida − COGS − taxas − frete absorvido = margem de contribuição − ads reais = resultado operacional.
3. Derive pedidos/ticket, margem por linha, CAC=ads/pedidos atribuíveis e ROAS=receita/ads, com escopo explícito. Boost identificado pelo objetivo entra integralmente na cascata, sai do denominador das réguas CAC/ROAS e ganha linha própria. Não divida por zero.
4. Confronte com CAC máximo do unit-economics recente, cite arquivo/mês, fontes e estimativas. Compare mês anterior quando disponível.
5. Grave relatorios/pnl-AAAA-MM.md sob financeiro resolvido, em BRL, sem mutação financeira ou na plataforma.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
