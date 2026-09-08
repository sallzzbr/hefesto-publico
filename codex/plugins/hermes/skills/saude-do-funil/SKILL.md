---
name: saude-do-funil
description: "Use para diagnosticar topo, meio e fundo do funil pago e localizar gargalo com réguas explícitas."
---

# saude-do-funil

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/saude-do-funil/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Fixe período (default last_7d), leia unit-economics vigente, benchmarks e registry. Sem economia, bloqueie essa parte e encaminhe unit-economics; referências genéricas são rotuladas, nunca régua local.
2. Colete conta e campanhas por gasto via conector de leitura disponível, com gasto/impressões/alcance/frequência/CTR/CPC/CPM/compras/ATC/checkout/ROAS. Boost por objetivo fica fora de diagnósticos de conversão, gasto preservado separado.
3. Calcule etapas topo, meio (ATC rate/CPATC), fundo (ATC→checkout→compra, CPA/ROAS). Denominador ausente ou zero não vira taxa inventada.
4. Produza tabela SAÚDE DO FUNIL com valor | benchmark e fonte | diagnóstico; cruze id com hipótese/critérios do registry. Abaixo do mínimo local (default R$50), dados insuficientes. Nomeie gargalo com número.
5. Entregue bloco para briefing ou resposta avulsa; fluxo chamador persiste o consolidado. Nenhuma mutação Meta.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
