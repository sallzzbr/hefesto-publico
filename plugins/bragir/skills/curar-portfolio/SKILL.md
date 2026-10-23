---
name: curar-portfolio
description: "Review and curate design portfolios. Use quando pedir avaliação de portfólio por URL, revisão pela ótica de contratação, nota e melhorias prioritárias, seleção ou revisão de cases, narrativa de contribuição e impacto ou preparação de trabalhos para uma oportunidade."
---

# Curar Portfólio

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md`. Resolva o portfólio em `projetos.md`/`local_portfolio` e leia as instruções do repositório alvo antes de editar. A metodologia não depende de framework, provedor ou pasta irmã específica.

## Revisão pela ótica de contratação

Para avaliar um portfólio por URL ou sua prontidão para apresentação, leia `${CLAUDE_PLUGIN_ROOT}/skills/curar-portfolio/references/revisao-contratacao.md` e use o modelo de relatório ali indicado. O modo adapta a skill `pd-portfolio-review`, de Leonardo Betti, com origem e licença nas referências. No Codex, os mesmos recursos ficam em `shared/skills/curar-portfolio/references/`.

Consulte primeiro URL, objetivo e senioridade nas fontes do workspace; pergunte apenas o que faltar para a entrega. Seleção de cases e curadoria de materiais podem avançar sem URL. Revisão de site depende de acesso observável: se houver só conteúdo extraído ou material fornecido, declare a cobertura parcial. Não atribua nota zero por falha da ferramenta. Pontuação é heurística de revisão, sem previsão de contratação.

## Fluxo

1. Inventarie cases e materiais existentes, curadoria aprovada, lacunas e restrições de divulgação. Não migre ou recrie o site para começar uma revisão. Repositório inacessível permite curadoria sobre materiais fornecidos, não alegação de inspeção do site.
2. Selecione cases pelo objetivo atual: competências demonstradas, contribuição individual, decisões, contexto e resultados sustentados. Vaga é opcional. Não confunda prestígio do cliente com qualidade da evidência.
3. Proponha narrativa por case: problema/contexto, papel e equipe, alternativas/decisões, execução, resultado e aprendizado. Não exija a mesma estrutura para todo projeto; sinalize dados ausentes e mantenha atribuições corretas.
4. Redija usando `bragir:escrever-como-antonio`. Para direção visual, use `bragir:direcionar-comunicacao-visual`. Não transforme material privado em público por estar no repo: valide permissão de uso, preserve áreas privadas, anonimizações e créditos.
5. Quando houver pedido de implementação, edite no repositório canônico, respeite seus contratos de build/testes e verifique a apresentação. Curadoria sozinha não autoriza deploy. Se ferramenta de implementação faltar, entregue pacote de conteúdo, estrutura e critérios de aceite.

## Output

Registre `portfolio/curadoria.md` com objetivo, seleção/ordem, evidências, lacunas e referências aos arquivos canônicos do projeto. Conteúdo e código pertencentes ao site permanecem nele; carreira guarda referências e decisões, não uma segunda cópia do site. Conclusão distingue texto preparado, alteração implementada, verificação e publicação.

No modo de revisão, salve `portfolio/revisoes/YYYY-MM-DD-dominio.md` com cobertura, evidências, pontuação quando sustentada e até cinco melhorias verificáveis. Em nova rodada no mesmo dia, use sufixo `-02`, `-03`; preserve relatórios anteriores. Atualize o estado do workspace com o resultado e o próximo passo. Não reescreva cases sem pedido; para redação autorizada, aplique `bragir:escrever-como-antonio`.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.
