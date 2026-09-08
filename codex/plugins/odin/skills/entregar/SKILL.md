---
name: entregar
description: "Use para executar ou retomar entrega concreta de software ou outro artefato, preparar SPEC ou avançar uma entrega do plano."
---

# entregar

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/entregar/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Procure entrega não-terminal antes de iniciar. Retome pelo Estado e Log (Log prevalece), sem recriar descrição/SPEC; registre retomada sem duplicar eventos. Leia capa e mostre 📍 quando existir desafio.
2. Faça preflight de git, working tree e gh quando houver PR; preserve alterações existentes e resolva conflito de escopo antes de branch. Detecte validações, branch principal, idioma, scopes e template. Classifique tarefa/problema/solução pronta e tipo de entrega pelo contrato.
3. Leia steps-detalhados.md, tipos-de-entrega.md e convenções necessárias. Crie arquivo da entrega no path resolvido após aprovação do conteúdo; registre branchBase. Explore, faça brainstorming quando disponível e escreva SPEC pelo template, com critérios, testes executáveis, restrições, non-goals e unidades disjuntas. Planner é papel Codex de arquitetura, sem exigir alias de outro provedor. Pedido só de SPEC termina aqui.
4. Obtenha aprovação da SPEC, modo Solo/Loop e perfil/opt-in quando Loop, aproveitando autorização existente. Registre contrato da sessão no Log. Garanta branch de trabalho autorizada; branch existente não é descartada nem renomeada silenciosamente.
5. Software exige testes vermelhos pelo motivo correto antes da implementação; implementador não afrouxa testes. Loop encaminha dev-loop e seu bridge. Solo aplica fases, self-review e os oito gates ponytail P1/P2/P13/P17, aninhamento, P10/P11/P12/P14, com log por fase. Não-software usa SPEC-lite e evidência por tipo, nunca harness de software.
6. Execute validações reais e registre limitações/manuais. Pendências fora do escopo vão ao arquivo resolvido, nunca ao commit. Commit/push/PR/publicação exigem autorização explícita; apresente artefato concreto e valide antes. Use paths específicos no stage, template real de PR e atribuição real, sem identidade de plataforma inventada.
7. Confirme efeitos externos antes de repeti-los na retomada. Só feche Estado/checklist/capa com evidências; próximo checkpoint é acompanhar quando houver dado.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
