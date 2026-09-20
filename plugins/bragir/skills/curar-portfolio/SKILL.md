---
name: curar-portfolio
description: "Curate professional portfolio. Use quando pedir seleção ou revisão de cases, narrativa de contribuição e impacto, reorganização de portfólio existente ou preparação de seleção de trabalhos para uma oportunidade."
---

# Curar Portfólio

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md`. Resolva o portfólio em `projetos.md`/`local_portfolio` e leia as instruções do repositório alvo antes de editar. A metodologia não depende de framework, provedor ou pasta irmã específica.

## Fluxo

1. Inventarie cases e materiais existentes, curadoria aprovada, lacunas e restrições de divulgação. Não migre ou recrie o site para começar uma revisão. Repositório inacessível permite curadoria sobre materiais fornecidos, não alegação de inspeção do site.
2. Selecione cases pelo objetivo atual: competências demonstradas, contribuição individual, decisões, contexto e resultados sustentados. Vaga é opcional. Não confunda prestígio do cliente com qualidade da evidência.
3. Proponha narrativa por case: problema/contexto, papel e equipe, alternativas/decisões, execução, resultado e aprendizado. Não exija a mesma estrutura para todo projeto; sinalize dados ausentes e mantenha atribuições corretas.
4. Redija usando `bragir:escrever-como-antonio`. Para direção visual, use `bragir:direcionar-comunicacao-visual`. Não transforme material privado em público por estar no repo: valide permissão de uso, preserve áreas privadas, anonimizações e créditos.
5. Quando houver pedido de implementação, edite no repositório canônico, respeite seus contratos de build/testes e verifique a apresentação. Curadoria sozinha não autoriza deploy. Se ferramenta de implementação faltar, entregue pacote de conteúdo, estrutura e critérios de aceite.

## Output

Registre `portfolio/curadoria.md` com objetivo, seleção/ordem, evidências, lacunas e referências aos arquivos canônicos do projeto. Conteúdo e código pertencentes ao site permanecem nele; carreira guarda referências e decisões, não uma segunda cópia do site. Conclusão distingue texto preparado, alteração implementada, verificação e publicação.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.
