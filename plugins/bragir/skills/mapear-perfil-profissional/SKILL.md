---
name: mapear-perfil-profissional
description: "Map professional evidence. Use quando quiser organizar trajetória, definir posicionamento profissional, iniciar o agente de carreira ou revisar competências e objetivos a partir de currículo, projetos e relatos."
---

# Mapear Perfil Profissional

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md` para paths, evidência, autorização e continuidade. Receba a intenção atual e fontes existentes: currículo, perfil, cases ou relatos. Não transforme esta leitura em entrevista obrigatória para usar outra skill.

## Fluxo

1. Recupere decisões e materiais anteriores. Separe o que já está confirmado do que é rascunho, sem obrigar o usuário a repetir a trajetória.
2. Organize experiências por período, papel, problema, contribuição, decisões e resultado, com referência de evidência. Reconheça confidencialidade e autoria coletiva.
3. Pergunte apenas lacunas relevantes ao objetivo: direção de carreira, tipos de papel, restrições de trabalho e preferências. Não deduza senioridade, salário desejado ou gestão de pessoas por título, idade ou prestígio da empresa.
4. Proponha posicionamento e competências sustentados por exemplos. Diferencie cargos já exercidos de papéis desejados e hipóteses a testar.
5. Escolha a próxima entrega útil com base no pedido: LinkedIn, case, avaliação de vaga ou candidatura. Não imponha publicar posts ou buscar vaga antes disso.

## Output

Atualize `perfil.md` com objetivo, trajetória, competências/evidências, restrições confirmadas e lacunas. Registre origens em `fontes.md` e a próxima ação em `estado.md`, nos paths resolvidos. Um perfil incompleto mas verdadeiro é utilizável. Para escrever prosa pública, use `bragir:escrever-como-antonio` com o perfil de voz resolvido; carreira não substitui voz.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.
