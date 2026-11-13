---
name: definir
description: "Define problema, placar e hipóteses com descobertas em mãos: fecha o problema, fixa o placar, escreve as hipóteses. Também solução técnica pronta sem placar: implementar BFF, refatorar arquitetura, criar design system, plataforma, observabilidade. Transforme missão técnica em problema e métrica ponte. Não use para investigar do zero (descobrir), priorizar alavancas (desenvolver), implementar entrega definida (entregar) ou re-medir desafio (acompanhar)."
---

# definir

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/definir/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Leia capa e descobertas.md quando existirem; confira GATE 1 e fase. Ausência de descoberta exige descobrir ou pulo explícito registrado pelo dono. Se o desafio não existe e o dono pediu definir direto, oferecer expresso ou completo com recomendação e escolha do dono; obter OK no slug/título antes de criar qualquer arquivo. Fazer uma pergunta por vez, encerrar o turno e reaproveitar as respostas já dadas, inclusive autorização do pulo. No completo, criar capa em DEFINE, registrar o pulo em Decisões e GATE 1 como não concluído, com nota do pulo e confiança justificada; GATE 2 fica aberto. Não inventar evidências: não inventar descobertas.md para suprir sua ausência; derivar o dossiê do contexto disponível e registrar lacunas. No expresso, seguir o protocolo de descobrir, sem repetir perguntas já respondidas nem exigir nova investigação; manter GATE E e GATE 4 abertos até critérios cumpridos e aprovação. Não aplicar os passos de DEFINE→DEVELOP abaixo ao expresso. Mostre 📍.
2. Derive rascunho do dossiê das evidências antes de perguntar. Problema é fenômeno observável. Placar tem 1 KPI primário, até 2 de suporte, fonte, janela, filtro, grão, baseline medido, alvo e guardrails com fonte/janela. Sem baseline: AUSENTE + plano, alvo provisório.
3. Escreva H1..Hn com causa suspeita, evidência, teste e força. Desafio técnico exige métrica ponte de negócio; BFF/refactor/plataforma permanece hipótese e enfrenta alternativa menor.
4. Conduza correções do dono uma pergunta por vez. Grave dossie.md pelo template: §§1–4; no técnico, semeie §6 com alternativa menor. Não invente placar nem decida sozinho.
5. Apresente readout curto de problema, régua, hipóteses e pendências. GATE 2 aprovado pelo dono atualiza capa/Artefatos/Confiança/Atualizada em e fase DEVELOP; só então encaminhe desenvolver.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
