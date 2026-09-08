---
name: analise-diaria
description: "Use para ritual diário ou snapshot somente leitura de conta Meta Ads, desempenho de anúncios e réguas de decisão."
---

# analise-diaria

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/analise-diaria/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Confirme workspace, conta e conector de leitura disponíveis. Faça lookup de unit-economics vigente, backlog, doutrina e registry; sem economia, encaminhe unit-economics. Hoje/diária escolhe ontem+MTD; snapshot aceita período pedido, default last_7d.
2. Diário: percorra campanha→conjunto→ad com effective_status. Só ACTIVE nos três níveis significa entregando. Verifique nominalmente anúncios reativados por lote contra decisões anteriores. Colete ontem e MTD por ad; detalhe funil quando sinal exigir.
3. Separe boost pelo optimization_goal/objetivo, nunca nome: gasto real em linha própria, fora de médias e vereditos de conversão. Estenda séries diárias; um dia seco não mata anúncio e janela mínima é 7 dias.
4. Mostre régua/fonte ao lado de cada número e use apenas MANTER / OBSERVAR / RÉGUA ATINGIDA — DECIDIR. Fadiga usa janelas iguais adjacentes; frequência MTD não é diária. Pacing >15% de desvio contra meta vigente é alerta.
5. Grave análise datada append-only e recomendações relevantes na trilha local do registry. Snapshot: conta+campanhas, top 5 por gasto, default mínimo R$50, abaixo dados insuficientes; salve em snapshots e não atualize registry. Erro de campo/permissão/período interrompe sem trocar janela silenciosamente.
6. Nenhuma criação, edição, ativação, pausa ou verba na plataforma.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
