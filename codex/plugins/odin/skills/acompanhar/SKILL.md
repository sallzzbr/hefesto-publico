---
name: acompanhar
description: "Review desafio ou missão em andamento: como está a missão, o placar andou, em que fase estamos, did the metric move, re-medir KPI, post-mortem, perseverar/pivotar/encerrar. Analisa resultados do experimento ou A/B que rodou. Não use para desafio novo/sintoma isolado (descobrir/definir), executar entrega ou construir dashboard/alerta/automação/configurar experimento (entregar), status de uma entrega isolada, nem revisar documento/apresentação ou workshop SOBRE missão."
---

# acompanhar

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/acompanhar/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Localize desafio e leia capa, dossie.md e plano.md. Sem estrutura, encaminhe descobrir/definir; ambiguidade pede identificação. Mostre 📍 e compare fase registrada com trabalho real.
2. Refaça medição com a MESMA fonte, janela, filtro e grão, incluindo guardrails. Fonte inacessível exige export especificado; mudança de régua é achado grave. Baseline AUSENTE exige verificar plano de obtenção antes de validar alvo.
3. Registre Diário do placar (§8); classifique hipóteses validada/refutada/pendente com evidência. Duas revisões sem teste sinalizam hipótese parada.
4. Aplique teste anti-tarefa completo do contrato: dois ou mais sinais exigem alerta e caminho de volta. Construir dashboard ou alerta é entregar, não este checkpoint.
5. Apresente perseverar/pivotar/encerrar para decisão humana. Registre confiança, pendências e decisões mesmo sem transição. Pivô invalida imediatamente alavancas/plano/entregas abertas com marca ⚠️ desatualizado. Encerramento exige fase ENCERRADO e Post-mortem na capa.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
