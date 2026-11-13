---
name: desafio
description: "Route explicit Odin challenge navigation: roteia este desafio, abre o roteador desafio, retoma o desafio pelo slug. Escolha a etapa pelo estado existente. Para intenção clara, prefira descobrir, definir, desenvolver, entregar ou acompanhar; status/placar é acompanhar. Não use para configurar defaults ou conversa SOBRE desafios."
---

# desafio

Leia [RUNTIME.md](../../RUNTIME.md), o [contrato de roteamento](../../shared/commands/desafio.md) e a [capa canônica](../../shared/skills/descobrir/references/capa-template.md). Este entrypoint é uma skill nativa Codex: referências históricas a `/desafio` significam esta skill, não um comando de terminal ou SlashCommand. O pedido vem da conversa, nunca de `$ARGUMENTS` presumido.

## Fluxo Codex

1. Resolva `dirDesafios` pelo RUNTIME: pedido explícito > `local_desafios` em `AGENTS.md` > defaults Codex > candidato único no workspace > default documentado. Os paths do contrato são exemplos do default, não hardcode. Liste capas existentes antes de criar. Legado `docs/missoes/` pode ser lido; migração exige pedido/autorização do dono, nunca mova automaticamente.
2. Use desafio explicitamente citado ou o único ativo pertinente. Dois ou mais ativos sem identificação exigem uma pergunta curta; não escolha nem crie outro silenciosamente. Tarefa avulsa, bug ou entrega sem relação com eles vai para [entregar](../entregar/SKILL.md), sem criar capa.
3. Leia a capa escolhida. Mostre jornada de cinco etapas, posição, confiança e pendências. Pedido de status/placar vai primeiro para [acompanhar](../acompanhar/SKILL.md), mesmo com artefato desatualizado. Ao avançar, reabra a etapa do artefato desatualizado ou registre a decisão explícita do dono de aceitar como está.
4. Fase registrada governa; artefatos desempatam: DISCOVER ou ausência de descobertas → [descobrir](../descobrir/SKILL.md); DEFINE ou descobertas sem dossiê/placar → [definir](../definir/SKILL.md); DEVELOP ou dossiê sem plano → [desenvolver](../desenvolver/SKILL.md); DELIVER com entregas abertas → entregar; DELIVER com todas entregues → acompanhar; ENCERRADO → acompanhar para consulta/post-mortem. No tier expresso, GATE E aberto → descobrir; fechado → regra DELIVER. Sem Tier, use completo.
5. Problema novo sem desafio correspondente vai para descobrir, que cataloga material pronto e conduz proporcionalidade/tier; não crie artefatos aqui. Dúvida real entre etapas ou desafio e tarefa exige uma questão curta, depois da leitura disponível.

## Saída

Informe desafio selecionado, evidência (fase/artefato), etapa e skill nativa de destino. Leia o entrypoint de destino e siga suas instruções na sessão. Ausência de ferramenta não autoriza simular execução nem iniciar controladores antes de seus gates.
